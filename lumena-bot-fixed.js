(() => {
    // Hapus HUD lama jika sudah ada
    const oldHud = document.getElementById('lumena-bot-hud');
    if (oldHud) oldHud.remove();

    const CONFIG = {
        TARGET_LIST: [
            "Marebyte", "Lithlet", "Glimfin", "Murkub", "Cinderook",
            "Ditpuff", "Starcalf", "Compasspook", "Transmole", "Nullimp",
            "Capsylex", "Corekit", "Lunaveil", "Chronobra", "Etherion",
            "Solshade"
        ],
        ALWAYS_CATCH_SHINY: true,
        XP_FARM_OTHERS: true,
        AUTO_FISHING: true, // Auto pancing aktif
        ACTION_DELAY_MS: 1100,
        SCAN_INTERVAL_MS: 400, // Interval lebih responsif untuk pancing
        WALK_STEP_DELAY_MS: 400,
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
    let walkDirection = 'KeyA';
    let lastWalkTime = 0;
    let lastFishCastTime = 0;
    let activeEncounterHandled = false;

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

    function detectEnemyLumen() {
        let name = '';
        let isShiny = false;

        if (
            document.querySelector('.lumen-shiny') ||
            document.querySelector('[class*="lumen-shiny"]') ||
            document.querySelector('.battle-enemy--shiny') ||
            document.querySelector('[style*="--shiny-filter"]')
        ) {
            isShiny = true;
        }

        const battleElements = document.querySelectorAll('.battle-ui, .battle-enemy, .battle-header, .battle-field');
        for (const el of battleElements) {
            if (el.textContent && (el.textContent.includes('✨') || el.textContent.toLowerCase().includes('shiny'))) {
                isShiny = true;
                break;
            }
        }

        const enemyNameSelectors = [
            '.battle-enemy-info__name',
            '.battle-enemy__name',
            '.battle-foe__name',
            '.battle-opponent__name',
            '.battle-enemy-card__title',
            '[data-battle-enemy-name]'
        ];
        for (const s of enemyNameSelectors) {
            const el = document.querySelector(s);
            if (el && el.textContent) {
                name = el.textContent.replace('✨', '').trim();
                break;
            }
        }

        if (!name) {
            const fullBattleText = document.querySelector('.battle-ui')?.innerText || '';
            for (const t of CONFIG.TARGET_LIST) {
                if (new RegExp('\\b' + t + '\\b', 'i').test(fullBattleText)) {
                    name = t;
                    break;
                }
            }
        }

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

    function triggerWalkStep() {
        if (!CONFIG.AUTO_WALK || isInBattle() || document.querySelector('.fishing-game')) return;
        const now = Date.now();
        if (now - lastWalkTime < CONFIG.WALK_STEP_DELAY_MS) return;
        lastWalkTime = now;

        walkDirection = (walkDirection === 'KeyA') ? 'KeyD' : 'KeyA';
        const key = (walkDirection === 'KeyA') ? 'a' : 'd';
        const keyCode = (walkDirection === 'KeyA') ? 65 : 68;

        const downEvent = new KeyboardEvent('keydown', {
            bubbles: true, cancelable: true, key, code: walkDirection, keyCode, which: keyCode
        });
        const upEvent = new KeyboardEvent('keyup', {
            bubbles: true, cancelable: true, key, code: walkDirection, keyCode, which: keyCode
        });

        window.dispatchEvent(downEvent);
        setTimeout(() => window.dispatchEvent(upEvent), 150);
        updateStatus(`Exploring rumput... [${walkDirection}]`);
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

        // 2. Pertarungan / Battle
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

        // 3. Cek Auto Pancing jika di dekat air atau sedang mancing
        const isFishingActive = handleAutoFishing();
        if (isFishingActive) {
            return;
        }

        // 4. Jika tidak sedang mancing -> auto walk hunting rumput
        triggerWalkStep();
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
