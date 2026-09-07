(() => {
    // Hapus HUD lama jika sudah ada
    const oldHud = document.getElementById('lumena-bot-hud');
    if (oldHud) oldHud.remove();

    const CONFIG = {
        TARGET_LIST: [
            "Transmole", "Marebyte", "Lotlume", "Lithlet", "Cairnling", "Glimfin",
            "Cinderook", "Combustler", "Sparkit", "Volterin", "Ditpuff",
            "Mimicorp", "Starcalf", "Cosmox", "Compasspook", "Astrowraith",
            "Nullimp", "Voidling", "Murkub", "Cindergill", "Capsylex",
            "Corekit", "Lunaveil", "Chronobra", "Etherion", "Solshade",
            "Bitauro"
        ],
        ALWAYS_CATCH_SHINY: true,
        XP_FARM_OTHERS: true,
        AUTO_FISHING: true, // Auto pancing aktif
        ACTION_DELAY_MS: 1100,
        SCAN_INTERVAL_MS: 400, // Interval lebih responsif untuk pancing
        WALK_STEP_DELAY_MS: 750,
        WALK_HOLD_MS: 75,
        WALK_RETURN_GAP_MS: 20,
        AUTO_WALK: true
    };

    const TARGET_SET = new Set(CONFIG.TARGET_LIST.map(n => n.trim().toLowerCase()));

    const STATS = {
        encounters: 0,
        shinyCaught: 0,
        targetCaught: 0,
        xpFarmed: 0,
        fishCaught: 0,
        running: true,
        currentAction: 'Inisialisasi...'
    };

    let isBusy = false;
    let isHoldingFish = false;
    let walkDirection = 'KeyS';
    let lastWalkTime = 0;
    let lastFishCastTime = 0;
    let activeEncounterHandled = false;
    let isWalking = false;

    const sleep = (ms) => new Promise(res => setTimeout(res, ms));

    function isInBattle() {
        return !!(
            document.querySelector('.battle-ui') ||
            document.querySelector('.battle-action-cluster') ||
            document.querySelector('.battle-action-button--fight') ||
            document.querySelector('.battle-command-center')
        );
    }

    function getPostBattleAdvanceTarget() {
        // Lumena menangani tap lanjutan battle lewat onPointerUp pada overlay ini,
        // bukan lewat event click pada tombol biasa.
        const advanceCatcher = document.querySelector('.battle-ui__advance-catcher');
        if (advanceCatcher) return advanceCatcher;

        const candidates = [
            '.battle-team__summary-close',
            '.battle-victory__continue',
            '.battle-results__continue',
            '.battle-summary__button',
            '.battle-caught__continue',
            'button.dialog-continue',
            'button[aria-label="Continue"]',
            'button[aria-label="Close"]'
        ];
        for (const s of candidates) {
            const el = document.querySelector(s);
            if (el && el.offsetParent !== null) return el;
        }
        const buttons = Array.from(document.querySelectorAll('button'));
        return buttons.find(b => {
            const txt = (b.innerText || b.textContent || '').trim().toLowerCase();
            return ['continue', 'claim', 'next', 'ok', 'close'].includes(txt) && b.offsetParent !== null;
        }) || null;
    }

    function activatePostBattleAdvance(target) {
        if (!target) return false;

        const advanceCatcher = document.querySelector('.battle-ui__advance-catcher');
        if (target === advanceCatcher) {
            const PointerCtor = typeof PointerEvent === 'function' ? PointerEvent : Event;
            const options = { bubbles: true, cancelable: true, pointerType: 'touch' };
            target.dispatchEvent(new PointerCtor('pointerdown', options));
            target.dispatchEvent(new PointerCtor('pointerup', options));
            return true;
        }

        target.click();
        return true;
    }

    function performForcedLumenSwitchStep() {
        let team = document.querySelector('.battle-team--forced');
        if (!team) {
            const candidate = document.querySelector('.battle-team');
            const title = candidate?.querySelector('.battle-team__title');
            if (/choose your next lumen/i.test(title?.textContent || '')) team = candidate;
        }
        if (!team) return null;

        // Sesudah satu Lumen dipilih, Lumena menampilkan tombol konfirmasi.
        const actions = Array.from(team.querySelectorAll('.battle-team__action'));
        const confirm = actions.find(button => {
            const label = (button.getAttribute?.('aria-label') || button.innerText || button.textContent || '').trim();
            return !button.disabled && /^swap lumens$/i.test(label);
        });
        if (confirm) {
            confirm.click();
            return 'confirmed';
        }

        // Pilih cadangan hidup pertama; jangan pernah memilih Lumen fainted/disabled.
        const rows = Array.from(team.querySelectorAll('.hud-menu__lumen-row'));
        const reserve = rows.find(row =>
            !row.disabled &&
            !row.classList.contains('hud-menu__lumen-row--fainted') &&
            !row.classList.contains('hud-menu__lumen-row--disabled') &&
            !/\b(?:fnt|fainted|in battle)\b/i.test(row.innerText || row.textContent || '')
        );
        if (!reserve) return 'waiting';

        reserve.click();
        return 'selected';
    }

    function detectEnemyLumen() {
        let name = '';
        let isShiny = false;

        // DOM Lumena saat ini mempunyai HUD terpisah untuk ally dan enemy.
        // Semua deteksi wajib dibatasi ke HUD enemy agar Lumen milik pemain
        // (termasuk shiny/target) tidak salah dianggap sebagai musuh.
        const enemyHud = document.querySelector('.battle-monster-hud--enemy');
        if (enemyHud) {
            const nameEl = enemyHud.querySelector('.battle-monster-hud__name-row strong') ||
                enemyHud.querySelector('.battle-monster-hud__name-row');
            name = (nameEl?.textContent || '').replace(/✨/g, '').trim();
            isShiny = !!enemyHud.querySelector('.lumen-shiny-mark') ||
                (nameEl?.textContent || '').includes('✨');
            return { name: name || 'Unknown Lumen', isShiny };
        }

        // Fallback untuk layout lama, tetap hanya mencari di kontainer musuh.
        const enemyRoot = document.querySelector('.battle-enemy, .battle-foe, .battle-opponent');
        if (enemyRoot) {
            const enemyNameSelectors = [
                '.battle-enemy-info__name',
                '.battle-enemy__name',
                '.battle-foe__name',
                '.battle-opponent__name',
                '.battle-enemy-card__title',
                '[data-battle-enemy-name]'
            ];
            for (const selector of enemyNameSelectors) {
                const el = enemyRoot.matches?.(selector) ? enemyRoot : enemyRoot.querySelector(selector);
                if (el?.textContent) {
                    name = el.textContent.replace(/✨/g, '').trim();
                    break;
                }
            }
            const enemyText = enemyRoot.textContent || '';
            isShiny = !!enemyRoot.querySelector('.lumen-shiny, .lumen-shiny-mark, .battle-enemy--shiny, [style*="--shiny-filter"]') ||
                enemyText.includes('✨') || /\bshiny\b/i.test(enemyText);
        }

        // Gagal membaca identitas musuh harus bersifat aman: serang, jangan
        // menghabiskan Lantern berdasarkan nama/shiny dari bagian UI lain.
        return { name: name || 'Unknown Lumen', isShiny };
    }

    async function executeCapture() {
        updateStatus('Membuka Bag...');
        const bagBtn = document.querySelector('.battle-action-button--bag') ||
            Array.from(document.querySelectorAll('.battle-action-button')).find(b => /bag|item/i.test(b.textContent));

        if (bagBtn && !bagBtn.disabled) {
            bagBtn.click();
            await sleep(CONFIG.ACTION_DELAY_MS);
        }

        const lanternSelectors = [
            '[data-item-category="capture_lantern"]',
            '[data-item-id*="lantern"]',
            '.battle-item-lantern',
            '.battle-item--capture',
            '.item-card--lantern'
        ];

        let lanternItem = null;
        for (const s of lanternSelectors) {
            lanternItem = document.querySelector(s);
            if (lanternItem) break;
        }

        if (!lanternItem) {
            const allItems = Array.from(document.querySelectorAll('.battle-item, .battle-bag__item, button, .item-card'));
            lanternItem = allItems.find(el => /lantern/i.test(el.textContent || el.getAttribute('aria-label') || ''));
        }

        if (lanternItem) {
            updateStatus('Menggunakan Lantern...');
            lanternItem.click();
            await sleep(CONFIG.ACTION_DELAY_MS);

            const confirmBtn = document.querySelector('.battle-modal__confirm, button[aria-label="Use"], button[aria-label="Confirm"]');
            if (confirmBtn) {
                confirmBtn.click();
                await sleep(CONFIG.ACTION_DELAY_MS);
            }
        } else {
            await executeAttack();
        }
    }

    async function executeAttack() {
        updateStatus('XP Farm: Serang...');
        const fightBtn = document.querySelector('.battle-action-button--fight') ||
            Array.from(document.querySelectorAll('.battle-action-button')).find(b => /fight|attack/i.test(b.textContent));

        if (fightBtn && !fightBtn.disabled) {
            fightBtn.click();
            await sleep(CONFIG.ACTION_DELAY_MS);
        }

        const moveSelectors = [
            '.battle-move-button:not([disabled])',
            '.battle-move:not([disabled])',
            '.battle-moves-grid button:not([disabled])',
            '[data-move-index="0"]'
        ];

        let moveBtn = null;
        for (const s of moveSelectors) {
            moveBtn = document.querySelector(s);
            if (moveBtn) break;
        }

        if (!moveBtn) {
            const moveButtons = Array.from(document.querySelectorAll('.battle-ui__command-shell--moves button, .battle-moves button'));
            moveBtn = moveButtons.find(b => !b.disabled && !b.classList.contains('battle-command-center'));
        }

        if (moveBtn) {
            updateStatus('Menyerang...');
            moveBtn.click();
            await sleep(CONFIG.ACTION_DELAY_MS);
        } else {
            const centerBtn = document.querySelector('.battle-command-center');
            if (centerBtn && !centerBtn.disabled) centerBtn.click();
        }
    }

    // =========================================================================
    // FITUR AUTO PANCING (FISHING)
    // =========================================================================

    function startFishHold(btn) {
        if (isHoldingFish) return;
        isHoldingFish = true;
        btn.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, cancelable: true }));
        window.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', code: 'Space', bubbles: true }));
    }

    function releaseFishHold() {
        if (!isHoldingFish) return;
        isHoldingFish = false;
        const btn = document.querySelector('.fishing-game__button');
        if (btn) {
            btn.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, cancelable: true }));
            btn.dispatchEvent(new PointerEvent('pointerleave', { bubbles: true, cancelable: true }));
        }
        window.dispatchEvent(new KeyboardEvent('keyup', { key: ' ', code: 'Space', bubbles: true }));
    }

    function handleAutoFishing() {
        if (!CONFIG.AUTO_FISHING || isInBattle()) return false;

        const fishingGame = document.querySelector('.fishing-game');

        // 1. Jika sedang dalam minigame mancing
        if (fishingGame) {
            const isEnding = fishingGame.classList.contains('fishing-game--ending') || 
                             !!fishingGame.querySelector('.fishing-game__sparkles');

            if (isEnding) {
                if (isHoldingFish) {
                    releaseFishHold();
                    STATS.fishCaught++;
                    renderHUD();
                }
                updateStatus('🎣 Ikan berhasil ditangkap!');
                return true;
            }

            const actionBtn = fishingGame.querySelector('.fishing-game__button');
            const titleEl = fishingGame.querySelector('.fishing-game__title');
            const titleText = (titleEl?.textContent || '').toLowerCase();

            // Cek apakah masih dalam fase "wait"
            const isWaiting = titleText.includes('wait') || titleText.includes('tunggu');

            if (!isWaiting && actionBtn && !actionBtn.disabled) {
                // Ikan muncul! Tap lalu Hold
                if (!isHoldingFish) {
                    updateStatus('🎣 Ikan muncul! Menahan (Hold) pancing...');
                    startFishHold(actionBtn);
                }
            } else {
                // Masih menunggu gigitan ikan
                if (isHoldingFish) releaseFishHold();
                updateStatus('🎣 Menunggu ikan memakan umpan (Wait)...');
            }
            return true;
        } else {
            if (isHoldingFish) {
                releaseFishHold();
            }
        }

        // 2. Jika tidak dalam minigame, cek tombol "Fish" saat berdiri di dekat air
        const fishBtn = document.querySelector('.fishing-button.fishing-button--visible') ||
                        Array.from(document.querySelectorAll('button')).find(b => {
                            const txt = (b.innerText || b.textContent || '').trim().toLowerCase();
                            return (txt === 'fish' || txt === 'press space to fish') && b.offsetParent !== null;
                        });

        if (fishBtn) {
            const now = Date.now();
            if (now - lastFishCastTime > 1500) {
                lastFishCastTime = now;
                updateStatus('🎣 Di dekat air: Melempar kail (Fish)...');
                fishBtn.click();
            }
            return true;
        }

        return false;
    }

    // =========================================================================
    // AUTO-WALK DI RUMPUT (JIKA TIDAK SEDANG MANCING)
    // =========================================================================

    function nextWalkDirection(current) {
        const directions = ['KeyD', 'KeyA', 'KeyW', 'KeyS'];
        const index = directions.indexOf(current);
        return directions[(index + 1) % directions.length];
    }

    function getWalkExcursion(direction) {
        const opposite = {
            KeyD: 'KeyA',
            KeyA: 'KeyD',
            KeyW: 'KeyS',
            KeyS: 'KeyW'
        };
        return [direction, opposite[direction]];
    }

    function getWalkControl(direction) {
        return {
            KeyD: { key: 'd', keyCode: 68, label: 'kanan' },
            KeyA: { key: 'a', keyCode: 65, label: 'kiri' },
            KeyW: { key: 'w', keyCode: 87, label: 'atas' },
            KeyS: { key: 's', keyCode: 83, label: 'bawah' }
        }[direction];
    }

    async function pulseWalkKey(direction) {
        const { key, keyCode } = getWalkControl(direction);
        window.dispatchEvent(new KeyboardEvent('keydown', {
            bubbles: true, cancelable: true, key, code: direction, keyCode, which: keyCode
        }));
        await sleep(CONFIG.WALK_HOLD_MS);
        window.dispatchEvent(new KeyboardEvent('keyup', {
            bubbles: true, cancelable: true, key, code: direction, keyCode, which: keyCode
        }));
    }

    async function triggerWalkStep() {
        if (!CONFIG.AUTO_WALK || isWalking || isInBattle() || document.querySelector('.fishing-game')) return;
        const now = Date.now();
        if (now - lastWalkTime < CONFIG.WALK_STEP_DELAY_MS) return;
        lastWalkTime = now;

        walkDirection = nextWalkDirection(walkDirection);
        const [outbound, inbound] = getWalkExcursion(walkDirection);
        const { label } = getWalkControl(outbound);

        // Bergerak sedikit lalu segera menekan arah kebalikan dengan durasi sama.
        // Ini membuat karakter menjelajah empat arah tanpa terus menjauh dari titik awal.
        isWalking = true;
        try {
            updateStatus(`Exploring dekat titik awal... [${label}]`);
            await pulseWalkKey(outbound);
            await sleep(CONFIG.WALK_RETURN_GAP_MS);
            await pulseWalkKey(inbound);
        } finally {
            isWalking = false;
        }
    }

    async function botLoopStep() {
        if (!STATS.running || isBusy) return;

        // 1. Selesaikan dialog hasil pertarungan
        const continueTarget = getPostBattleAdvanceTarget();
        if (continueTarget) {
            isBusy = true;
            updateStatus('Selesai battle...');
            activatePostBattleAdvance(continueTarget);
            activeEncounterHandled = false;
            // Layar hasil dapat mempunyai dua tahap; beri waktu singkat lalu
            // loop berikutnya akan menekan tahap selanjutnya secara otomatis.
            await sleep(350);
            isBusy = false;
            return;
        }

        // 2. Jika Lumen aktif kalah, pilih otomatis cadangan yang masih hidup.
        const switchStep = performForcedLumenSwitchStep();
        if (switchStep) {
            isBusy = true;
            if (isHoldingFish) releaseFishHold();
            updateStatus(switchStep === 'confirmed'
                ? 'Lumen pengganti masuk...'
                : switchStep === 'selected'
                    ? 'Memilih Lumen yang masih hidup...'
                    : 'Menunggu Lumen pengganti...');
            await sleep(350);
            isBusy = false;
            return;
        }

        // 3. Pertarungan / Battle
        if (isInBattle()) {
            isBusy = true;
            if (isHoldingFish) releaseFishHold();

            const enemy = detectEnemyLumen();
            const normalizedName = enemy.name.toLowerCase().trim();
            const isTarget = TARGET_SET.has(normalizedName);

            if (enemy.isShiny) {
                updateStatus(`✨ SHINY: [${enemy.name}]! Tangkap...`);
                if (!activeEncounterHandled) {
                    STATS.encounters++;
                    STATS.shinyCaught++;
                    activeEncounterHandled = true;
                    renderHUD();
                }
                await executeCapture();
            } else if (isTarget) {
                updateStatus(`🎯 TARGET: [${enemy.name}]! Tangkap...`);
                if (!activeEncounterHandled) {
                    STATS.encounters++;
                    STATS.targetCaught++;
                    activeEncounterHandled = true;
                    renderHUD();
                }
                await executeCapture();
            } else {
                updateStatus(`⚔️ XP FARM: [${enemy.name}]! Serang...`);
                if (!activeEncounterHandled) {
                    STATS.encounters++;
                    STATS.xpFarmed++;
                    activeEncounterHandled = true;
                    renderHUD();
                }
                await executeAttack();
            }

            await sleep(CONFIG.ACTION_DELAY_MS);
            isBusy = false;
            return;
        }

        activeEncounterHandled = false;

        // 4. Cek Auto Pancing jika di dekat air atau sedang mancing
        const isFishingActive = handleAutoFishing();
        if (isFishingActive) {
            return;
        }

        // 5. Jika tidak sedang mancing -> auto walk hunting rumput
        await triggerWalkStep();
    }

    function createHUD() {
        const hud = document.createElement('div');
        hud.id = 'lumena-bot-hud';
        hud.style.cssText = `
            position: fixed;
            top: 10px;
            right: 10px;
            z-index: 9999999;
            max-width: 270px;
            width: calc(100vw - 20px);
            background: rgba(13, 17, 23, 0.95);
            border: 1px solid #30363d;
            border-radius: 8px;
            color: #f0f6fc;
            font-family: sans-serif;
            font-size: 11px;
            box-shadow: 0 4px 16px rgba(0,0,0,0.7);
            padding: 10px;
            user-select: none;
        `;

        hud.innerHTML = `
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px; border-bottom: 1px solid #30363d; padding-bottom: 4px;">
                <strong style="color: #58a6ff; font-size: 12px;">Lumena Bot + Pancing</strong>
                <div style="display: flex; align-items: center; gap: 4px;">
                    <span id="bot-status-badge" style="background: #238636; color: #fff; padding: 2px 5px; border-radius: 4px; font-weight: bold; font-size: 9px;">AKTIF</span>
                    <button id="bot-minimize-btn" style="background: transparent; color: #8b949e; border: none; font-size: 14px; cursor: pointer; padding: 0 4px;">−</button>
                </div>
            </div>
            <div id="bot-hud-body">
                <div style="margin-bottom: 6px; font-size: 10px; color: #8b949e;" id="bot-current-action">
                    Menunggu aksi...
                </div>
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 4px; margin-bottom: 8px;">
                    <div style="background: #161b22; padding: 5px; border-radius: 5px; border-left: 3px solid #e3b341;">
                        <div style="color: #8b949e; font-size: 9px;">✨ Shiny</div>
                        <div id="stat-shiny" style="font-size: 13px; font-weight: bold; color: #e3b341;">0</div>
                    </div>
                    <div style="background: #161b22; padding: 5px; border-radius: 5px; border-left: 3px solid #2ea043;">
                        <div style="color: #8b949e; font-size: 9px;">🎯 Target</div>
                        <div id="stat-target" style="font-size: 13px; font-weight: bold; color: #3fb950;">0</div>
                    </div>
                    <div style="background: #161b22; padding: 5px; border-radius: 5px; border-left: 3px solid #1f6feb;">
                        <div style="color: #8b949e; font-size: 9px;">⚔️ XP Farm</div>
                        <div id="stat-xp" style="font-size: 13px; font-weight: bold; color: #58a6ff;">0</div>
                    </div>
                    <div style="background: #161b22; padding: 5px; border-radius: 5px; border-left: 3px solid #a371f7;">
                        <div style="color: #8b949e; font-size: 9px;">🎣 Fish Catch</div>
                        <div id="stat-fish" style="font-size: 13px; font-weight: bold; color: #bc8cff;">0</div>
                    </div>
                </div>
                <div style="display: flex; gap: 4px; margin-bottom: 4px;">
                    <button id="bot-toggle-btn" style="flex: 1; background: #da3633; color: #fff; border: none; border-radius: 5px; padding: 5px 0; font-weight: bold; font-size: 10px; cursor: pointer;">
                        Pause
                    </button>
                    <button id="bot-fish-toggle-btn" style="flex: 1; background: #238636; color: #fff; border: none; border-radius: 5px; padding: 5px 0; font-weight: bold; font-size: 10px; cursor: pointer;">
                        Pancing: ON
                    </button>
                </div>
                <div style="display: flex; gap: 4px;">
                    <button id="bot-target-btn" style="flex: 1; background: #21262d; color: #c9d1d9; border: 1px solid #30363d; border-radius: 5px; padding: 4px 0; font-size: 10px; cursor: pointer;">
                        Targets (${CONFIG.TARGET_LIST.length})
                    </button>
                </div>
                <div id="bot-target-dropdown" style="display: none; margin-top: 6px; max-height: 100px; overflow-y: auto; background: #0d1117; padding: 5px; border-radius: 4px; border: 1px solid #30363d; font-size: 9px; color: #8b949e;">
                    ${CONFIG.TARGET_LIST.map(n => `<div>• ${n}</div>`).join('')}
                </div>
            </div>
        `;

        document.body.appendChild(hud);

        let isMinimized = false;
        document.getElementById('bot-minimize-btn').addEventListener('click', () => {
            isMinimized = !isMinimized;
            const body = document.getElementById('bot-hud-body');
            const minBtn = document.getElementById('bot-minimize-btn');
            if (isMinimized) {
                body.style.display = 'none';
                minBtn.textContent = '+';
                hud.style.width = 'auto';
            } else {
                body.style.display = 'block';
                minBtn.textContent = '−';
                hud.style.width = 'calc(100vw - 20px)';
            }
        });

        document.getElementById('bot-toggle-btn').addEventListener('click', () => {
            STATS.running = !STATS.running;
            const badge = document.getElementById('bot-status-badge');
            const btn = document.getElementById('bot-toggle-btn');
            if (STATS.running) {
                badge.style.background = '#238636';
                badge.textContent = 'AKTIF';
                btn.style.background = '#da3633';
                btn.textContent = 'Pause';
                updateStatus('Bot dilanjutkan...');
            } else {
                badge.style.background = '#6e7681';
                badge.textContent = 'PAUSED';
                btn.style.background = '#238636';
                btn.textContent = 'Mulai';
                releaseFishHold();
                updateStatus('Bot di-pause.');
            }
        });

        document.getElementById('bot-fish-toggle-btn').addEventListener('click', () => {
            CONFIG.AUTO_FISHING = !CONFIG.AUTO_FISHING;
            const btn = document.getElementById('bot-fish-toggle-btn');
            if (CONFIG.AUTO_FISHING) {
                btn.style.background = '#238636';
                btn.textContent = 'Pancing: ON';
                updateStatus('Auto Pancing diaktifkan.');
            } else {
                btn.style.background = '#6e7681';
                btn.textContent = 'Pancing: OFF';
                releaseFishHold();
                updateStatus('Auto Pancing dinonaktifkan.');
            }
        });

        document.getElementById('bot-target-btn').addEventListener('click', () => {
            const dropdown = document.getElementById('bot-target-dropdown');
            dropdown.style.display = dropdown.style.display === 'none' ? 'block' : 'none';
        });
    }

    function updateStatus(text) {
        STATS.currentAction = text;
        const el = document.getElementById('bot-current-action');
        if (el) el.textContent = text;
        console.log(`[LumenaBot] ${text}`);
    }

    function renderHUD() {
        const sShiny = document.getElementById('stat-shiny');
        const sTarget = document.getElementById('stat-target');
        const sXp = document.getElementById('stat-xp');
        const sFish = document.getElementById('stat-fish');

        if (sShiny) sShiny.textContent = STATS.shinyCaught;
        if (sTarget) sTarget.textContent = STATS.targetCaught;
        if (sXp) sXp.textContent = STATS.xpFarmed;
        if (sFish) sFish.textContent = STATS.fishCaught;
    }

    createHUD();
    updateStatus('Bot + Auto Pancing aktif!');
    if (window._lumenaBotTimer) clearInterval(window._lumenaBotTimer);
    window._lumenaBotTimer = setInterval(() => {
        botLoopStep().catch(err => console.error('[LumenaBot Error]', err));
    }, CONFIG.SCAN_INTERVAL_MS);

    console.log('%c[LumenaBot] Bot + Auto Pancing Siap!', 'background: #238636; color: white; padding: 4px; font-weight: bold;');
})();
