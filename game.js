// ==========================================================
// 1. DOM要素の取得
// ==========================================================
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const startScreen = document.getElementById('startScreen');
const rankingScreen = document.getElementById('rankingScreen');
const gameOverScreen = document.getElementById('gameOverScreen');
const startButton = document.getElementById('startButton');
const showRankingButton = document.getElementById('showRankingButton');
const backToMenuButton = document.getElementById('backToMenuButton');
const submitScoreButton = document.getElementById('submitScoreButton');
const restartButton = document.getElementById('restartButton');
const backToMenuFromGameOver = document.getElementById('backToMenuFromGameOver');
const leftJoystickArea = document.getElementById('leftJoystickArea');
const leftJoystick = document.getElementById('leftJoystick');
const rightJoystickArea = document.getElementById('rightJoystickArea');
const rightJoystick = document.getElementById('rightJoystick');
const attackButton = document.getElementById('attackButton');
const hpDisplay = document.getElementById('hp');
const scoreDisplay = document.getElementById('score');
const alliesDisplay = document.getElementById('allies');
const levelDisplay = document.getElementById('level');
const stageDisplay = document.getElementById('stage');
const playerNameInput = document.getElementById('playerNameInput');
const walletInput = document.getElementById('walletInput');
const walletError = document.getElementById('walletError');
const rankingTable = document.getElementById('rankingTable');
const qrModal = document.getElementById('qrModal');
const qrCodeDiv = document.getElementById('qrCode');
const walletAddressDisplay = document.getElementById('walletAddress');
const bossHealthBar = document.getElementById('bossHealthBar');
const bossHealthFill = document.getElementById('bossHealthFill');

// ==========================================================
// 2. ゲームの状態とオブジェクトの宣言と初期化
// ==========================================================

let gameState = {
    running: false,
    score: 0,
    hp: 100,
    allies: 0,
    level: 1,
    stage: 1,
    backgroundOffset: 0,
    bossActive: false,
    bossKilled: false,
    bossSpawnScore: 1000, // ボス出現スコア
    lastBossScore: 0, // 最後にボスが出現したスコア
    isGameOver: false,
    currentRank: -1 // ゲームオーバー時の順位
};

let player = {
    x: 0,
    y: 0,
    size: 25,
    speed: 5,
    color: '#FF69B4',
    lastShotTime: 0,
    shootCooldown: 150 // 150ms
};

let boss = null;
let enemies = [];
let bullets = [];
let collectibles = [];
let allyDrones = [];
let particles = [];
let clouds = [];
let mountains = [];
let buildings = [];
let stars = []; // 夜背景用

let keys = {};
let touchInput = {
    left: { active: false, startX: 0, startY: 0, currentX: 0, currentY: 0, dx: 0, dy: 0, identifier: null },
    right: { active: false, startX: 0, startY: 0, currentX: 0, currentY: 0, dx: 0, dy: 0, identifier: null },
    attack: { active: false, identifier: null }
};

let gameLoopRequestId;
let rankings = [];
let lastFrameTime = 0;
const MAX_FPS = 60;
const MIN_FRAME_TIME = 1000 / MAX_FPS;

// ==========================================================
// 3. API関数 (Vercel Functionsを想定)
// ==========================================================

// スコア送信API
async function submitScoreAPI(playerName, score, level, stage, walletAddress = '') {
    try {
        const response = await fetch('/api/submit-score', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                playerName,
                score,
                level,
                stage,
                walletAddress
            })
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.message || 'スコア送信に失敗しました');
        }

        const result = await response.json();
        console.log('Score submission result:', result);
        return result; // { success: true, rank: number | null }
    } catch (error) {
        console.error('スコア送信エラー:', error);
        alert(`スコア送信エラー: ${error.message}`);
        throw error;
    }
}

// ランキング取得API
async function getRankingsAPI() {
    try {
        const response = await fetch('/api/get-rankings');
        if (!response.ok) {
            throw new Error('ランキング取得に失敗しました');
        }
        const data = await response.json();
        console.log('Rankings received:', data);
        return data.rankings || []; // [{ playerName, score, level, stage, walletAddress, hasWallet }, ...]
    } catch (error) {
        console.error('ランキング取得エラー:', error);
        rankingTable.innerHTML = '<div style="text-align: center; padding: 20px; color: #FF6666;">ランキングの読み込みに失敗しました。</div>';
        return [];
    }
}

// ウォレットアドレス検証API (オプション)
async function verifyWalletAPI(walletAddress) {
    // XRP Ledgerのアドレス形式をクライアントサイドでまず検証
    if (!/^[r][rpshnaf39wBUDNEGHJKLM4PQRST7VWXYZ2bcdeCg65jkm8oFqi1tuvAxyz]{24,34}$/.test(walletAddress)) {
        return { valid: false, message: '無効なアドレス形式です。' };
    }
    // 必要であればサーバーサイドで追加検証
    // try {
    //     const response = await fetch('/api/verify-wallet', {
    //         method: 'POST',
    //         headers: { 'Content-Type': 'application/json' },
    //         body: JSON.stringify({ walletAddress })
    //     });
    //     if (!response.ok) return { valid: false, message: 'サーバー検証エラー' };
    //     return await response.json(); // { valid: true }
    // } catch (error) {
    //     return { valid: false, message: '検証中にエラーが発生しました' };
    // }
    return { valid: true }; // クライアントサイド検証のみ
}

// ==========================================================
// 4. 関数定義
// ==========================================================

// キャンバスリサイズ
function resizeCanvas() {
    const aspectRatio = 4 / 3; // ゲームの基本アスペクト比
    const maxWidth = window.innerWidth * 0.95;
    const maxHeight = window.innerHeight * 0.75;

    let newWidth = maxWidth;
    let newHeight = newWidth / aspectRatio;

    if (newHeight > maxHeight) {
        newHeight = maxHeight;
        newWidth = newHeight * aspectRatio;
    }

    canvas.width = Math.max(newWidth, 320); // 最小幅
    canvas.height = Math.max(newHeight, 240); // 最小高さ

    // プレイヤー位置調整
    if (gameState.running) {
        player.x = Math.min(player.x, canvas.width - player.size / 2);
        player.y = Math.min(player.y, canvas.height - player.size / 2);
        player.x = Math.max(player.x, player.size / 2);
        player.y = Math.max(player.y, player.size / 2);
    } else {
        player.x = canvas.width / 2;
        player.y = canvas.height / 2;
    }
}

// ゲーム開始
function startGame() {
    hideAllScreens();
    gameState.running = true;
    gameState.isGameOver = false;
    gameState.hp = 100;
    gameState.score = 0;
    gameState.allies = 0;
    gameState.level = 1;
    gameState.stage = 1;
    gameState.bossActive = false;
    gameState.bossKilled = false;
    gameState.bossSpawnScore = 1000;
    gameState.lastBossScore = 0;
    gameState.currentRank = -1;

    player.x = canvas.width / 2;
    player.y = canvas.height / 2;
    boss = null;
    bossHealthBar.style.display = 'none';
    walletInput.style.display = 'none';
    walletError.style.display = 'none';
    playerNameInput.value = localStorage.getItem('playerName') || ''; // 前回の名前を読み込む

    initializeGame();

    if (!gameLoopRequestId) {
        lastFrameTime = performance.now();
        gameLoop();
    }
    document.getElementById('controls').style.display = 'flex';
    updateUI();
}

// 全画面非表示
function hideAllScreens() {
    startScreen.style.display = 'none';
    rankingScreen.style.display = 'none';
    gameOverScreen.style.display = 'none';
    qrModal.style.display = 'none';
}

// ゲームオーバー処理
async function gameOver() {
    if (gameState.isGameOver) return; // 既にゲームオーバー処理中なら何もしない
    gameState.isGameOver = true;
    gameState.running = false;
    if (gameLoopRequestId) {
        cancelAnimationFrame(gameLoopRequestId);
        gameLoopRequestId = null;
    }

    document.getElementById('controls').style.display = 'none';
    bossHealthBar.style.display = 'none';

    document.getElementById('finalScore').textContent = `最終スコア: ${gameState.score}`;
    document.getElementById('finalLevel').textContent = `到達レベル: ${gameState.level} | ステージ: ${gameState.stage}`;

    gameOverScreen.style.display = 'flex';

    // ランキング取得して順位を確認
    try {
        const currentRankings = await getRankingsAPI();
        let rank = -1;
        // スコアが既存の10位より高いか、またはランキングが10件未満かチェック
        if (currentRankings.length < 10 || gameState.score > (currentRankings[9]?.score || 0)) {
            // プレイヤーがトップ10に入る可能性がある
            // 正確な順位はサーバー側で決定されるが、ここでは仮に表示を制御
            rank = currentRankings.findIndex(r => gameState.score > r.score);
            if (rank === -1) rank = currentRankings.length; // 最下位に追加の場合
            rank += 1; // 1ベースの順位に
            gameState.currentRank = rank;

            if (rank <= 3) {
                walletInput.style.display = 'block';
                walletInput.placeholder = `XAMAN Wallet アドレス (${rank}位)`;
            } else {
                walletInput.style.display = 'none';
            }
        } else {
            // トップ10圏外
            walletInput.style.display = 'none';
            submitScoreButton.textContent = 'ランキング圏外';
            submitScoreButton.disabled = true;
        }
    } catch (error) {
        console.error("ゲームオーバー時のランキング取得失敗:", error);
        // エラー時もスコア送信は試みる
        walletInput.style.display = 'block'; // とりあえず表示しておく
        walletInput.placeholder = 'XAMAN Wallet アドレス (上位3位の場合)';
    }
}

// ゲーム初期化
function initializeGame() {
    enemies = [];
    bullets = [];
    collectibles = [];
    allyDrones = [];
    particles = [];

    if (gameState.stage === 1) {
        initializeDayBackground();
    } else {
        initializeNightBackground();
    }

    spawnInitialObjects();
}

// 昼背景初期化
function initializeDayBackground() {
    initializeClouds();
    initializeMountains();
    initializeBuildings();
    stars = []; // 星をクリア
}

// 夜背景初期化
function initializeNightBackground() {
    initializeStars();
    initializeMountains();
    initializeBuildings();
    clouds = []; // 雲をクリア
}

// 雲初期化
function initializeClouds() {
    clouds = [];
    for (let i = 0; i < 8; i++) {
        clouds.push({
            x: Math.random() * canvas.width * 1.5,
            y: Math.random() * (canvas.height * 0.4) + 20,
            size: Math.random() * 40 + 30,
            speed: Math.random() * 0.5 + 0.2
        });
    }
}

// 星初期化
function initializeStars() {
    stars = [];
    for (let i = 0; i < 100; i++) { // 星の数を増やす
        stars.push({
            x: Math.random() * canvas.width,
            y: Math.random() * canvas.height * 0.8, // 表示範囲を広げる
            size: Math.random() * 1.5 + 0.5,
            opacity: Math.random() * 0.5 + 0.3,
            twinkleSpeed: Math.random() * 0.05 + 0.01
        });
    }
}

// 山初期化
function initializeMountains() {
    mountains = [];
    let currentX = -50;
    const mountainColors = gameState.stage === 1
        ? ['#A0522D', '#8B4513', '#CD853F']
        : ['#2F4F4F', '#556B2F', '#696969'];
    for (let i = 0; i < 6; i++) {
        const width = Math.random() * 150 + 100;
        const height = Math.random() * 150 + 120;
        mountains.push({
            x: currentX,
            y: canvas.height - height,
            width: width,
            height: height,
            color: mountainColors[Math.floor(Math.random() * mountainColors.length)]
        });
        currentX += width * (Math.random() * 0.5 + 0.5);
    }
}

// 建物初期化
function initializeBuildings() {
    buildings = [];
    let currentX = 0;
    const buildingColors = gameState.stage === 1
        ? ['#D2B48C', '#F5DEB3', '#FFE4C4']
        : ['#778899', '#708090', '#B0C4DE'];
    for (let i = 0; i < 15; i++) { // 建物の数を増やす
        const width = Math.random() * 40 + 30;
        const height = Math.random() * 100 + 50;
        buildings.push({
            x: currentX + Math.random() * 20,
            y: canvas.height - height,
            width: width,
            height: height,
            color: buildingColors[Math.floor(Math.random() * buildingColors.length)],
            windows: Math.random() > 0.3 // 夜用に窓の明かり
        });
        currentX += width + 10;
        if (currentX > canvas.width * 2) break;
    }
}

// 初期オブジェクト配置
function spawnInitialObjects() {
    for (let i = 0; i < 3 + gameState.stage; i++) { // ステージに応じて敵増加
        spawnEnemy();
    }
    for (let i = 0; i < 5; i++) {
        spawnCollectible();
    }
    for (let i = 0; i < 2; i++) {
        spawnAllyCandidate();
    }
}

// ボス出現
function spawnBoss() {
    if (gameState.bossActive || boss) return;

    gameState.bossActive = true;
    boss = {
        x: canvas.width / 2,
        y: canvas.height * 0.2,
        size: 80 + gameState.stage * 10, // ステージでサイズ変更
        maxHp: 100 + gameState.stage * 50, // ステージでHP増加
        hp: 100 + gameState.stage * 50,
        speed: 2 + gameState.stage * 0.5, // ステージで速度増加
        color: gameState.stage === 1 ? '#8B0000' : '#4B0082',
        angle: 0,
        lastShotTime: Date.now(),
        shootCooldown: 1000 - gameState.stage * 100, // ステージで攻撃間隔短縮
        phase: 1,
        movePattern: Math.floor(Math.random() * 3), // 3種類の移動パターン
        attackPattern: Math.floor(Math.random() * 3), // 3種類の攻撃パターン
        attackTimer: 0
    };

    bossHealthBar.style.display = 'block';
    updateBossHealthBar();
    // ボス出現演出（例：画面シェイク）
    addScreenShake(10, 500);
}

// ボスHPバー更新
function updateBossHealthBar() {
    if (boss) {
        const healthPercent = Math.max(0, (boss.hp / boss.maxHp) * 100);
        bossHealthFill.style.width = healthPercent + '%';
    }
}

// 敵出現
function spawnEnemy() {
    enemies.push({
        x: Math.random() < 0.5 ? -30 : canvas.width + 30, // 画面外から出現
        y: Math.random() * (canvas.height * 0.6),
        size: 20,
        speed: Math.random() * 1.5 + 1 + gameState.stage * 0.5,
        hp: 2 + Math.floor(gameState.stage / 2),
        color: gameState.stage === 1 ? '#FF4444' : '#800080',
        type: Math.random() > 0.4 ? 'chaser' : (Math.random() > 0.5 ? 'patrol' : 'shooter'), // 新タイプ追加
        angle: Math.random() * Math.PI * 2,
        lastShotTime: Date.now() + Math.random() * 3000,
        shootCooldown: 2500 - gameState.stage * 200
    });
}

// アイテム出現
function spawnCollectible() {
    collectibles.push({
        x: Math.random() * canvas.width,
        y: Math.random() * (canvas.height - 50) + 25,
        size: 15,
        type: Math.random() > 0.2 ? 'star' : 'heart', // スターの出現率アップ
        bounce: Math.random() * Math.PI * 2,
        collected: false,
        creationTime: Date.now()
    });
}

// 仲間候補出現
function spawnAllyCandidate() {
    collectibles.push({
        x: Math.random() * canvas.width,
        y: Math.random() * (canvas.height - 50) + 25,
        size: 20,
        type: 'ally',
        bounce: Math.random() * Math.PI * 2,
        collected: false,
        creationTime: Date.now()
    });
}

// 弾発射
function shootBullet() {
    const now = Date.now();
    if (now - player.lastShotTime < player.shootCooldown) return;
    player.lastShotTime = now;

    bullets.push({
        x: player.x,
        y: player.y - player.size * 0.6,
        size: 6,
        speed: 8,
        color: '#FFD700',
        type: 'player'
    });

    // 仲間ドローンも発射
    allyDrones.forEach(ally => {
        bullets.push({
            x: ally.x,
            y: ally.y - ally.size * 0.6,
            size: 4,
            speed: 7,
            color: '#00FFFF',
            type: 'ally'
        });
    });
}

// プレイヤー更新
function updatePlayer(deltaTime) {
    let dx = 0;
    let dy = 0;

    // キーボード入力
    if (keys['w'] || keys['arrowup']) dy -= 1;
    if (keys['s'] || keys['arrowdown']) dy += 1;
    if (keys['a'] || keys['arrowleft']) dx -= 1;
    if (keys['d'] || keys['arrowright']) dx += 1;

    // タッチ入力 (左ジョイスティック)
    if (touchInput.left.active) {
        const joystickRadius = leftJoystickArea.offsetWidth / 2;
        dx += touchInput.left.dx / joystickRadius;
        dy += touchInput.left.dy / joystickRadius;
    }

    // 正規化して速度を適用
    const magnitude = Math.sqrt(dx * dx + dy * dy);
    if (magnitude > 0) {
        const moveSpeed = player.speed * (deltaTime / (1000 / 60)); // deltaTime補正
        player.x += (dx / magnitude) * moveSpeed;
        player.y += (dy / magnitude) * moveSpeed;
    }

    // 画面境界チェック
    player.x = Math.max(player.size / 2, Math.min(canvas.width - player.size / 2, player.x));
    player.y = Math.max(player.size / 2, Math.min(canvas.height - player.size / 2, player.y));

    // 攻撃 (右ジョイスティック or ボタン)
    if (touchInput.attack.active || keys[' ']) {
        shootBullet();
    }
}

// ボス更新
function updateBoss(deltaTime) {
    if (!boss) return;

    const now = Date.now();
    const dtFactor = deltaTime / (1000 / 60); // deltaTime補正係数
    boss.attackTimer += deltaTime;
    boss.angle += 0.02 * dtFactor;

    // 移動パターン
    switch (boss.movePattern) {
        case 0: // 左右往復
            boss.x += Math.cos(boss.angle) * boss.speed * dtFactor;
            if (boss.x <= boss.size || boss.x >= canvas.width - boss.size) {
                boss.angle += Math.PI; // 方向転換
            }
            break;
        case 1: // 上下波状
            boss.y += Math.sin(boss.angle * 2) * boss.speed * 0.5 * dtFactor;
            if (boss.y <= boss.size || boss.y >= canvas.height * 0.4) {
                boss.angle += Math.PI / 2; // パターン変更
            }
            break;
        case 2: // プレイヤー追従 (ゆっくり)
            const targetDx = player.x - boss.x;
            const targetDy = player.y - boss.y;
            const distToPlayer = Math.sqrt(targetDx * targetDx + targetDy * targetDy);
            if (distToPlayer > 100) { // ある程度離れていたら近づく
                boss.x += (targetDx / distToPlayer) * boss.speed * 0.3 * dtFactor;
                boss.y += (targetDy / distToPlayer) * boss.speed * 0.3 * dtFactor;
            }
            break;
    }

    // 画面境界チェック
    boss.x = Math.max(boss.size, Math.min(canvas.width - boss.size, boss.x));
    boss.y = Math.max(boss.size, Math.min(canvas.height * 0.4, boss.y));

    // 攻撃パターン
    if (now - boss.lastShotTime > boss.shootCooldown) {
        boss.lastShotTime = now;
        switch (boss.attackPattern) {
            case 0: // 扇状攻撃
                for (let i = 0; i < (boss.phase === 1 ? 5 : 7); i++) {
                    const angleOffset = (Math.PI / (boss.phase === 1 ? 6 : 8)) * (i - Math.floor((boss.phase === 1 ? 5 : 7) / 2));
                    bullets.push({
                        x: boss.x,
                        y: boss.y + boss.size / 2,
                        size: 8,
                        vx: Math.sin(angleOffset) * 4,
                        vy: Math.cos(angleOffset) * 4,
                        color: gameState.stage === 1 ? '#FF0000' : '#8000FF',
                        type: 'boss'
                    });
                }
                break;
            case 1: // プレイヤー狙い撃ち
                const dx = player.x - boss.x;
                const dy = player.y - boss.y;
                const dist = Math.sqrt(dx * dx + dy * dy);
                if (dist > 0) {
                    bullets.push({
                        x: boss.x,
                        y: boss.y + boss.size / 2,
                        size: 10 + boss.phase * 2,
                        vx: (dx / dist) * (5 + boss.phase),
                        vy: (dy / dist) * (5 + boss.phase),
                        color: gameState.stage === 1 ? '#FF4444' : '#FF00FF',
                        type: 'boss'
                    });
                }
                break;
            case 2: // ランダム弾幕
                for (let i = 0; i < (boss.phase === 1 ? 8 : 12); i++) {
                    const randomAngle = Math.random() * Math.PI * 2;
                    bullets.push({
                        x: boss.x,
                        y: boss.y + boss.size / 2,
                        size: 6,
                        vx: Math.cos(randomAngle) * (3 + Math.random() * 2),
                        vy: Math.sin(randomAngle) * (3 + Math.random() * 2),
                        color: gameState.stage === 1 ? '#FFA500' : '#DA70D6',
                        type: 'boss'
                    });
                }
                break;
        }
        // 一定時間で攻撃パターン変更
        if (boss.attackTimer > 15000) { // 15秒ごと
            boss.attackPattern = (boss.attackPattern + 1) % 3;
            boss.attackTimer = 0;
        }
    }

    // フェーズ変更
    const healthPercent = boss.hp / boss.maxHp;
    if (healthPercent < 0.5 && boss.phase === 1) {
        boss.phase = 2;
        boss.speed += 1;
        boss.shootCooldown = Math.max(300, boss.shootCooldown - 200);
        // フェーズ変更演出
        addScreenShake(5, 300);
        createExplosion(boss.x, boss.y, 30, boss.color);
    }
}

// 敵更新
function updateEnemies(deltaTime) {
    const dtFactor = deltaTime / (1000 / 60);
    enemies.forEach((enemy, index) => {
        // 移動
        switch (enemy.type) {
            case 'chaser':
                const dx = player.x - enemy.x;
                const dy = player.y - enemy.y;
                const dist = Math.sqrt(dx * dx + dy * dy);
                if (dist > 0) {
                    enemy.x += (dx / dist) * enemy.speed * dtFactor;
                    enemy.y += (dy / dist) * enemy.speed * dtFactor;
                }
                break;
            case 'patrol':
                enemy.x += Math.cos(enemy.angle) * enemy.speed * dtFactor;
                enemy.y += Math.sin(enemy.angle) * enemy.speed * 0.5 * dtFactor;
                if (enemy.x < 0 || enemy.x > canvas.width || enemy.y < 0 || enemy.y > canvas.height * 0.8) {
                    enemy.angle += Math.PI / 2 + Math.random() * Math.PI;
                }
                break;
            case 'shooter':
                enemy.y += enemy.speed * 0.3 * dtFactor; // ゆっくり下降
                if (enemy.y > canvas.height * 0.7) enemy.y = canvas.height * 0.7;
                // 攻撃
                const now = Date.now();
                if (now - enemy.lastShotTime > enemy.shootCooldown) {
                    enemy.lastShotTime = now;
                    const bulletAngle = Math.atan2(player.y - enemy.y, player.x - enemy.x);
                    bullets.push({
                        x: enemy.x,
                        y: enemy.y + enemy.size / 2,
                        size: 5,
                        vx: Math.cos(bulletAngle) * 3,
                        vy: Math.sin(bulletAngle) * 3,
                        color: gameState.stage === 1 ? '#FF6347' : '#BA55D3',
                        type: 'enemy'
                    });
                }
                break;
        }

        // 画面外に出たら削除 (ただし、画面外から出現する敵は除く)
        if (enemy.y > canvas.height + enemy.size) {
            enemies.splice(index, 1);
        }
    });

    // 新しい敵をスポーン
    if (Math.random() < 0.01 + gameState.stage * 0.005 && enemies.length < 10 + gameState.stage * 2) {
        spawnEnemy();
    }
}

// 弾更新
function updateBullets(deltaTime) {
    const dtFactor = deltaTime / (1000 / 60);
    bullets.forEach((bullet, index) => {
        if (bullet.type === 'player' || bullet.type === 'ally') {
            bullet.y -= bullet.speed * dtFactor;
        } else { // enemy or boss
            bullet.x += bullet.vx * dtFactor;
            bullet.y += bullet.vy * dtFactor;
        }

        // 画面外判定
        if (bullet.y < -bullet.size || bullet.y > canvas.height + bullet.size || bullet.x < -bullet.size || bullet.x > canvas.width + bullet.size) {
            bullets.splice(index, 1);
        }
    });
}

// アイテム更新
function updateCollectibles(deltaTime) {
    const dtFactor = deltaTime / (1000 / 60);
    const now = Date.now();
    collectibles.forEach((item, index) => {
        item.bounce += 0.1 * dtFactor;
        item.y += Math.sin(item.bounce) * 0.3 * dtFactor;

        // 一定時間で消滅
        if (now - item.creationTime > 15000) { // 15秒
            collectibles.splice(index, 1);
        }
    });

    // 新しいアイテムをスポーン
    if (Math.random() < 0.008 && collectibles.filter(c => c.type !== 'ally').length < 8) {
        spawnCollectible();
    }
    // 新しい仲間候補をスポーン
    if (Math.random() < 0.002 && collectibles.filter(c => c.type === 'ally').length < 2 && allyDrones.length < 3) {
        spawnAllyCandidate();
    }
}

// 仲間ドローン更新
function updateAllyDrones(deltaTime) {
    const dtFactor = deltaTime / (1000 / 60);
    allyDrones.forEach((ally, index) => {
        const targetX = player.x + (index % 2 === 0 ? -40 : 40); // プレイヤーの左右に配置
        const targetY = player.y + 20;
        ally.x += (targetX - ally.x) * 0.1 * dtFactor;
        ally.y += (targetY - ally.y) * 0.1 * dtFactor;
    });
}

// パーティクル更新
function updateParticles(deltaTime) {
    const dtFactor = deltaTime / (1000 / 60);
    particles.forEach((p, index) => {
        p.x += p.vx * dtFactor;
        p.y += p.vy * dtFactor;
        p.vy += 0.1 * dtFactor; // 重力
        p.life -= deltaTime;
        p.opacity = Math.max(0, p.life / p.initialLife);

        if (p.life <= 0) {
            particles.splice(index, 1);
        }
    });
}

// 背景更新
function updateBackground(deltaTime) {
    const dtFactor = deltaTime / (1000 / 60);
    gameState.backgroundOffset += 0.5 * dtFactor; // 背景スクロール速度

    // 雲
    clouds.forEach(cloud => {
        cloud.x -= cloud.speed * dtFactor;
        if (cloud.x < -cloud.size * 2) {
            cloud.x = canvas.width + Math.random() * 50;
            cloud.y = Math.random() * (canvas.height * 0.4) + 20;
        }
    });

    // 星 (瞬き)
    stars.forEach(star => {
        star.opacity = 0.5 + Math.sin(performance.now() * star.twinkleSpeed * 0.001) * 0.3;
    });
}

// 衝突判定
function checkCollisions() {
    // プレイヤー弾 vs 敵
    bullets.forEach((bullet, bIndex) => {
        if (bullet.type === 'player' || bullet.type === 'ally') {
            enemies.forEach((enemy, eIndex) => {
                if (isColliding(bullet, enemy)) {
                    enemy.hp -= (bullet.type === 'player' ? 2 : 1); // プレイヤー弾の方が強力
                    createExplosion(bullet.x, bullet.y, 5, bullet.color);
                    bullets.splice(bIndex, 1);
                    if (enemy.hp <= 0) {
                        createExplosion(enemy.x, enemy.y, enemy.size, enemy.color);
                        enemies.splice(eIndex, 1);
                        gameState.score += 50;
                        gameState.level = Math.floor(gameState.score / 500) + 1;
                        // 確率でアイテムドロップ
                        if (Math.random() < 0.2) spawnCollectibleAt(enemy.x, enemy.y);
                    }
                    return; // 弾は1ヒットで消える
                }
            });

            // プレイヤー弾 vs ボス
            if (boss && isColliding(bullet, boss)) {
                boss.hp -= (bullet.type === 'player' ? 2 : 1);
                createExplosion(bullet.x, bullet.y, 5, bullet.color);
                bullets.splice(bIndex, 1);
                updateBossHealthBar();
                if (boss.hp <= 0) {
                    bossDefeated();
                }
                return;
            }
        }
    });

    // 敵弾/ボス弾 vs プレイヤー
    bullets.forEach((bullet, bIndex) => {
        if (bullet.type === 'enemy' || bullet.type === 'boss') {
            if (isColliding(bullet, player)) {
                gameState.hp -= (bullet.type === 'enemy' ? 5 : 10); // ボス弾の方が痛い
                createExplosion(bullet.x, bullet.y, 10, '#FFFFFF');
                bullets.splice(bIndex, 1);
                addScreenShake(5, 100);
                if (gameState.hp <= 0) {
                    gameOver();
                }
                return;
            }
        }
    });

    // 敵 vs プレイヤー
    enemies.forEach((enemy, eIndex) => {
        if (isColliding(enemy, player)) {
            gameState.hp -= 15;
            createExplosion(enemy.x, enemy.y, enemy.size, enemy.color);
            createExplosion(player.x, player.y, 15, '#FFFFFF');
            enemies.splice(eIndex, 1);
            addScreenShake(8, 200);
            if (gameState.hp <= 0) {
                gameOver();
            }
        }
    });

    // ボス vs プレイヤー
    if (boss && isColliding(boss, player)) {
        gameState.hp -= 25;
        createExplosion(player.x, player.y, 20, '#FFFFFF');
        addScreenShake(15, 300);
        // ボスとの衝突ではボスは消えないが、プレイヤーは少しノックバック
        const dx = player.x - boss.x;
        const dy = player.y - boss.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist > 0) {
            player.x += (dx / dist) * 20;
            player.y += (dy / dist) * 20;
        }
        if (gameState.hp <= 0) {
            gameOver();
        }
    }

    // プレイヤー vs アイテム
    collectibles.forEach((item, index) => {
        if (isColliding(player, item)) {
            switch (item.type) {
                case 'star':
                    gameState.score += 100;
                    gameState.level = Math.floor(gameState.score / 500) + 1;
                    break;
                case 'heart':
                    gameState.hp = Math.min(100, gameState.hp + 15);
                    break;
                case 'ally':
                    if (allyDrones.length < 3) { // 最大3機まで
                        addAllyDrone();
                        gameState.allies = allyDrones.length;
                    }
                    break;
            }
            createExplosion(item.x, item.y, item.size, item.type === 'star' ? '#FFD700' : (item.type === 'heart' ? '#FF69B4' : '#00FFFF'));
            collectibles.splice(index, 1);
        }
    });
}

// 衝突判定ヘルパー
function isColliding(obj1, obj2) {
    const dx = obj1.x - obj2.x;
    const dy = obj1.y - obj2.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    return distance < (obj1.size / 2 + obj2.size / 2);
}

// 爆発エフェクト生成
function createExplosion(x, y, size, color) {
    for (let i = 0; i < size; i++) {
        particles.push({
            x: x,
            y: y,
            vx: (Math.random() - 0.5) * (Math.random() * 6),
            vy: (Math.random() - 0.5) * (Math.random() * 6),
            size: Math.random() * 3 + 1,
            color: color,
            life: Math.random() * 500 + 200, // ms
            initialLife: Math.random() * 500 + 200,
            opacity: 1
        });
    }
}

// アイテムドロップ
function spawnCollectibleAt(x, y) {
    const type = Math.random() > 0.3 ? 'star' : 'heart';
    collectibles.push({
        x: x,
        y: y,
        size: 15,
        type: type,
        bounce: Math.random() * Math.PI * 2,
        collected: false,
        creationTime: Date.now()
    });
}

// 仲間ドローン追加
function addAllyDrone() {
    allyDrones.push({
        x: player.x,
        y: player.y + 30,
        size: 15,
        color: '#00FFFF'
    });
}

// 画面シェイク
let screenShakeMagnitude = 0;
let screenShakeDuration = 0;
let screenShakeStartTime = 0;

function addScreenShake(magnitude, duration) {
    screenShakeMagnitude = Math.max(screenShakeMagnitude, magnitude);
    screenShakeDuration = Math.max(screenShakeDuration, duration);
    screenShakeStartTime = performance.now();
}

function applyScreenShake(ctx) {
    const elapsed = performance.now() - screenShakeStartTime;
    if (elapsed < screenShakeDuration) {
        const progress = 1 - (elapsed / screenShakeDuration);
        const currentMagnitude = screenShakeMagnitude * progress;
        const offsetX = (Math.random() - 0.5) * currentMagnitude;
        const offsetY = (Math.random() - 0.5) * currentMagnitude;
        ctx.translate(offsetX, offsetY);
    } else {
        screenShakeMagnitude = 0;
        screenShakeDuration = 0;
    }
}

// ボス撃破処理
function bossDefeated() {
    createExplosion(boss.x, boss.y, boss.size * 2, boss.color); // 大きな爆発
    gameState.score += 500 * gameState.stage; // ステージに応じたボーナス
    gameState.level = Math.floor(gameState.score / 500) + 1;
    gameState.bossActive = false;
    gameState.bossKilled = true;
    boss = null;
    bossHealthBar.style.display = 'none';
    addScreenShake(20, 1000); // 大きなシェイク

    // 次のステージへ
    gameState.stage++;
    gameState.bossKilled = false; // 次のステージ用にリセット
    gameState.lastBossScore = gameState.score; // ボス出現スコア基準を更新
    gameState.bossSpawnScore = gameState.lastBossScore + 1000 * gameState.stage; // 次のボス出現スコア設定

    // ステージ移行演出（例：画面フラッシュ）
    flashScreen('#FFFFFF', 500);

    // 少し待ってからゲーム状態をリセットして再開
    setTimeout(() => {
        initializeGame(); // 背景や敵をリセット
        // プレイヤーの状態は維持（HP回復などしても良い）
        gameState.hp = Math.min(100, gameState.hp + 30); // ステージクリアボーナスHP
    }, 1500);
}

// 画面フラッシュ
let flashColor = null;
let flashDuration = 0;
let flashStartTime = 0;

function flashScreen(color, duration) {
    flashColor = color;
    flashDuration = duration;
    flashStartTime = performance.now();
}

function drawFlash(ctx) {
    const elapsed = performance.now() - flashStartTime;
    if (elapsed < flashDuration) {
        const alpha = 1 - (elapsed / flashDuration);
        ctx.fillStyle = `rgba(${hexToRgb(flashColor)}, ${alpha})`;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
    } else {
        flashColor = null;
    }
}

function hexToRgb(hex) {
    hex = hex.replace(/^#/, '');
    const bigint = parseInt(hex, 16);
    const r = (bigint >> 16) & 255;
    const g = (bigint >> 8) & 255;
    const b = bigint & 255;
    return `${r}, ${g}, ${b}`;
}

// UI更新
function updateUI() {
    hpDisplay.textContent = Math.max(0, gameState.hp);
    scoreDisplay.textContent = gameState.score;
    alliesDisplay.textContent = gameState.allies;
    levelDisplay.textContent = gameState.level;
    stageDisplay.textContent = gameState.stage;
    document.getElementById('stageDisplay').innerHTML = `${gameState.stage === 1 ? '🌅' : '🌃'} ステージ: <span id="stage">${gameState.stage}</span>`;
}

// ランキング表示
async function displayRankings() {
    rankingTable.innerHTML = '<div style="text-align: center; padding: 20px;">ランキングを読み込み中...</div>';
    rankings = await getRankingsAPI(); // APIから取得
    rankings.sort((a, b) => b.score - a.score); // スコアで降順ソート

    rankingTable.innerHTML = ''; // テーブルクリア

    if (rankings.length === 0) {
        rankingTable.innerHTML = '<div style="text-align: center; padding: 20px;">まだランキングデータがありません。</div>';
        return;
    }

    rankings.slice(0, 10).forEach((entry, index) => {
        const row = document.createElement('div');
        row.classList.add('ranking-row');
        if (index < 3) {
            row.classList.add('top3');
        }

        let walletInfo = '';
        if (index < 3 && entry.hasWallet) {
            // トップ3でウォレット登録済みの場合、QR表示ボタンを追加
            walletInfo = `<button class="qr-button" data-wallet="${entry.walletAddress}">QR</button>`;
        }

        row.innerHTML = `
            <span>${index + 1}. ${escapeHTML(entry.playerName)}</span>
            <span>スコア: ${entry.score} (L:${entry.level} S:${entry.stage})</span>
            ${walletInfo}
        `;
        rankingTable.appendChild(row);
    });

    // QRボタンにイベントリスナーを追加
    document.querySelectorAll('.qr-button').forEach(button => {
        button.addEventListener('click', (e) => {
            e.stopPropagation(); // 親要素へのイベント伝播を停止
            const walletAddress = e.target.getAttribute('data-wallet');
            showQRModal(walletAddress);
        });
        // スタイル調整
        button.style.padding = '3px 8px';
        button.style.fontSize = '12px';
        button.style.marginLeft = '10px';
        button.style.cursor = 'pointer';
        button.style.background = '#4CAF50';
        button.style.color = 'white';
        button.style.border = 'none';
        button.style.borderRadius = '5px';
    });
}

// HTMLエスケープ
function escapeHTML(str) {
    const p = document.createElement('p');
    p.textContent = str;
    return p.innerHTML;
}

// QRコードモーダル表示
function showQRModal(walletAddress) {
    if (!walletAddress) return;
    walletAddressDisplay.textContent = `アドレス: ${walletAddress}`;
    qrCodeDiv.innerHTML = ''; // 前回のQRコードをクリア

    // XRP Payment URIを生成 (例: 固定額1 XRP)
    // const paymentUri = `ripple:${walletAddress}?amount=1000000`; // 1 XRP = 1,000,000 drops
    const paymentUri = `ripple:${walletAddress}`; // 金額指定なし

    QRCode.toCanvas(paymentUri, { errorCorrectionLevel: 'H', width: 200 }, function (error, canvas) {
        if (error) {
            console.error('QRコード生成エラー:', error);
            qrCodeDiv.innerHTML = 'QRコードの生成に失敗しました。';
            return;
        }
        qrCodeDiv.appendChild(canvas);
    });

    qrModal.style.display = 'flex';
}

// QRコードモーダル非表示
function closeQRModal() {
    qrModal.style.display = 'none';
}

// ==========================================================
// 5. 描画関数
// ==========================================================

function draw() {
    // 背景クリア
    ctx.fillStyle = gameState.stage === 1 ? '#87CEEB' : '#000033'; // 昼/夜
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // 画面シェイク適用開始
    ctx.save();
    applyScreenShake(ctx);

    // 背景描画
    drawBackground();

    // オブジェクト描画
    drawCollectibles();
    drawAllyDrones();
    drawPlayer();
    drawEnemies();
    drawBoss();
    drawBullets();
    drawParticles();

    // 画面フラッシュ描画
    drawFlash(ctx);

    // 画面シェイク適用終了
    ctx.restore();

    // UI更新
    updateUI();
}

function drawBackground() {
    const bgOffset = gameState.backgroundOffset % (canvas.width * 2); // 背景ループ用

    // 夜空の星
    if (gameState.stage === 2) {
        drawStars();
    }

    // 山
    drawMountains(bgOffset * 0.3); // 遠景はゆっくり動く

    // 建物
    drawBuildings(bgOffset * 0.6); // 中景

    // 昼空の雲
    if (gameState.stage === 1) {
        drawClouds();
    }
}

function drawStars() {
    stars.forEach(star => {
        ctx.fillStyle = `rgba(255, 255, 255, ${star.opacity})`;
        ctx.beginPath();
        ctx.arc(star.x, star.y, star.size, 0, Math.PI * 2);
        ctx.fill();
    });
}

function drawMountains(offset) {
    mountains.forEach(mountain => {
        const x = (mountain.x - offset + canvas.width * 2) % (canvas.width * 2);
        ctx.fillStyle = mountain.color;
        ctx.beginPath();
        ctx.moveTo(x, canvas.height);
        ctx.lineTo(x + mountain.width / 2, mountain.y);
        ctx.lineTo(x + mountain.width, canvas.height);
        ctx.closePath();
        ctx.fill();
    });
}

function drawBuildings(offset) {
    buildings.forEach(building => {
        const x = (building.x - offset + canvas.width * 2) % (canvas.width * 2);
        ctx.fillStyle = building.color;
        ctx.fillRect(x, building.y, building.width, building.height);

        // 夜の窓の明かり
        if (gameState.stage === 2 && building.windows && Math.random() < 0.6) {
            ctx.fillStyle = '#FFFFE0'; // 薄い黄色
            const windowWidth = building.width * 0.2;
            const windowHeight = building.height * 0.1;
            const gap = building.width * 0.1;
            for (let wy = building.y + gap; wy < canvas.height - windowHeight; wy += windowHeight + gap) {
                for (let wx = x + gap; wx < x + building.width - windowWidth; wx += windowWidth + gap) {
                    if (Math.random() < 0.4) { // ランダムに点灯
                        ctx.fillRect(wx, wy, windowWidth, windowHeight);
                    }
                }
            }
        }
    });
}

function drawClouds() {
    clouds.forEach(cloud => {
        ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
        ctx.beginPath();
        ctx.arc(cloud.x, cloud.y, cloud.size, 0, Math.PI * 2);
        ctx.arc(cloud.x + cloud.size * 0.6, cloud.y, cloud.size * 0.8, 0, Math.PI * 2);
        ctx.arc(cloud.x - cloud.size * 0.6, cloud.y, cloud.size * 0.7, 0, Math.PI * 2);
        ctx.fill();
    });
}

function drawPlayer() {
    ctx.fillStyle = player.color;
    ctx.beginPath();
    ctx.arc(player.x, player.y, player.size / 2, 0, Math.PI * 2);
    ctx.fill();
    // プロペラ的なもの
    ctx.fillStyle = '#AAAAAA';
    ctx.fillRect(player.x - player.size * 0.6, player.y - player.size * 0.1, player.size * 1.2, player.size * 0.2);
}

function drawEnemies() {
    enemies.forEach(enemy => {
        ctx.fillStyle = enemy.color;
        ctx.beginPath();
        // 敵の形を少し変える
        if (enemy.type === 'shooter') {
            ctx.rect(enemy.x - enemy.size / 2, enemy.y - enemy.size / 2, enemy.size, enemy.size);
        } else {
            ctx.arc(enemy.x, enemy.y, enemy.size / 2, 0, Math.PI * 2);
        }
        ctx.fill();
    });
}

function drawBoss() {
    if (!boss) return;
    ctx.fillStyle = boss.color;
    ctx.beginPath();
    // ボスの形を複雑に
    const radius = boss.size / 2;
    ctx.moveTo(boss.x + radius * Math.cos(boss.angle), boss.y + radius * Math.sin(boss.angle));
    for (let i = 1; i <= 6; i++) {
        const angle = boss.angle + (i * Math.PI * 2 / 6);
        const outerRadius = i % 2 === 0 ? radius : radius * 0.7;
        ctx.lineTo(boss.x + outerRadius * Math.cos(angle), boss.y + outerRadius * Math.sin(angle));
    }
    ctx.closePath();
    ctx.fill();
    // ボスの中心に目のようなものを描画
    ctx.fillStyle = '#FFFFFF';
    ctx.beginPath();
    ctx.arc(boss.x, boss.y, radius * 0.3, 0, Math.PI * 2);
    ctx.fill();
}

function drawBullets() {
    bullets.forEach(bullet => {
        ctx.fillStyle = bullet.color;
        ctx.beginPath();
        ctx.arc(bullet.x, bullet.y, bullet.size / 2, 0, Math.PI * 2);
        ctx.fill();
    });
}

function drawCollectibles() {
    collectibles.forEach(item => {
        ctx.save();
        ctx.translate(item.x, item.y);
        ctx.rotate(Math.sin(item.bounce) * 0.1);
        ctx.fillStyle = item.type === 'star' ? '#FFD700' : (item.type === 'heart' ? '#FF69B4' : '#00FFFF');
        ctx.beginPath();
        if (item.type === 'star') {
            // 星形
            const outerRadius = item.size;
            const innerRadius = item.size / 2;
            for (let i = 0; i < 10; i++) {
                const radius = i % 2 === 0 ? outerRadius : innerRadius;
                const angle = Math.PI / 5 * i - Math.PI / 2;
                ctx.lineTo(radius * Math.cos(angle), radius * Math.sin(angle));
            }
        } else if (item.type === 'heart') {
            // ハート形
            const d = Math.min(item.size, item.size);
            const k = -d / 1.5;
            ctx.moveTo(0, k + d / 4);
            ctx.bezierCurveTo(0, k, -d / 2, k, -d / 2, k + d / 4);
            ctx.bezierCurveTo(-d / 2, k + d / 2, 0, k + d / 2, 0, k + d * 3 / 4);
            ctx.bezierCurveTo(0, k + d / 2, d / 2, k + d / 2, d / 2, k + d / 4);
            ctx.bezierCurveTo(d / 2, k, 0, k, 0, k + d / 4);
        } else { // ally
            ctx.arc(0, 0, item.size / 2, 0, Math.PI * 2);
        }
        ctx.closePath();
        ctx.fill();
        ctx.restore();
    });
}

function drawAllyDrones() {
    allyDrones.forEach(ally => {
        ctx.fillStyle = ally.color;
        ctx.beginPath();
        ctx.arc(ally.x, ally.y, ally.size / 2, 0, Math.PI * 2);
        ctx.fill();
    });
}

function drawParticles() {
    particles.forEach(p => {
        ctx.fillStyle = `rgba(${hexToRgb(p.color)}, ${p.opacity})`;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
    });
}

// ==========================================================
// 6. ゲームループ
// ==========================================================

function gameLoop(timestamp) {
    if (!gameState.running) {
        gameLoopRequestId = null;
        return;
    }

    const deltaTime = timestamp - lastFrameTime;

    // FPS制限
    if (deltaTime >= MIN_FRAME_TIME) {
        lastFrameTime = timestamp - (deltaTime % MIN_FRAME_TIME);

        // 更新処理
        updatePlayer(deltaTime);
        updateEnemies(deltaTime);
        updateBoss(deltaTime);
        updateBullets(deltaTime);
        updateCollectibles(deltaTime);
        updateAllyDrones(deltaTime);
        updateParticles(deltaTime);
        updateBackground(deltaTime);

        // 衝突判定
        checkCollisions();

        // ボス出現チェック
        if (!gameState.bossActive && !boss && gameState.score >= gameState.bossSpawnScore) {
            spawnBoss();
        }

        // 描画処理
        draw();
    }

    // 次のフレームを要求
    gameLoopRequestId = requestAnimationFrame(gameLoop);
}

// ==========================================================
// 7. イベントリスナー
// ==========================================================

// キーボード入力
window.addEventListener('keydown', (e) => {
    keys[e.key.toLowerCase()] = true;
    // スペースキーでのスクロール防止
    if (e.key === ' ') {
        e.preventDefault();
    }
});
window.addEventListener('keyup', (e) => {
    keys[e.key.toLowerCase()] = false;
});

// タッチ入力
function handleTouchStart(e) {
    e.preventDefault(); // デフォルトのタッチ動作（スクロールなど）を防止
    const touches = e.changedTouches;
    for (let i = 0; i < touches.length; i++) {
        const touch = touches[i];
        const touchX = touch.clientX;
        const touchY = touch.clientY;

        // 左ジョイスティック領域
        const leftRect = leftJoystickArea.getBoundingClientRect();
        if (touchX >= leftRect.left && touchX <= leftRect.right && touchY >= leftRect.top && touchY <= leftRect.bottom) {
            if (!touchInput.left.active) {
                touchInput.left.active = true;
                touchInput.left.identifier = touch.identifier;
                touchInput.left.startX = leftRect.left + leftRect.width / 2;
                touchInput.left.startY = leftRect.top + leftRect.height / 2;
                touchInput.left.currentX = touchX;
                touchInput.left.currentY = touchY;
                updateJoystick(leftJoystick, touchInput.left);
            }
            continue;
        }

        // 右ジョイスティック領域 (攻撃用)
        const rightRect = rightJoystickArea.getBoundingClientRect();
        if (touchX >= rightRect.left && touchX <= rightRect.right && touchY >= rightRect.top && touchY <= rightRect.bottom) {
            if (!touchInput.right.active) {
                touchInput.right.active = true;
                touchInput.right.identifier = touch.identifier;
                touchInput.right.startX = rightRect.left + rightRect.width / 2;
                touchInput.right.startY = rightRect.top + rightRect.height / 2;
                touchInput.right.currentX = touchX;
                touchInput.right.currentY = touchY;
                updateJoystick(rightJoystick, touchInput.right);
                // 右ジョイスティックは攻撃トリガーにも
                touchInput.attack.active = true;
            }
            continue;
        }

        // 攻撃ボタン領域
        const attackRect = attackButton.getBoundingClientRect();
        if (touchX >= attackRect.left && touchX <= attackRect.right && touchY >= attackRect.top && touchY <= attackRect.bottom) {
            if (!touchInput.attack.active) {
                touchInput.attack.active = true;
                touchInput.attack.identifier = touch.identifier;
                attackButton.style.transform = 'scale(0.9)';
            }
            continue;
        }
    }
}

function handleTouchMove(e) {
    e.preventDefault();
    const touches = e.changedTouches;
    for (let i = 0; i < touches.length; i++) {
        const touch = touches[i];

        if (touch.identifier === touchInput.left.identifier) {
            touchInput.left.currentX = touch.clientX;
            touchInput.left.currentY = touch.clientY;
            updateJoystick(leftJoystick, touchInput.left);
        }
        if (touch.identifier === touchInput.right.identifier) {
            touchInput.right.currentX = touch.clientX;
            touchInput.right.currentY = touch.clientY;
            updateJoystick(rightJoystick, touchInput.right);
        }
    }
}

function handleTouchEnd(e) {
    e.preventDefault();
    const touches = e.changedTouches;
    for (let i = 0; i < touches.length; i++) {
        const touch = touches[i];
        if (touch.identifier === touchInput.left.identifier) {
            touchInput.left.active = false;
            touchInput.left.identifier = null;
            resetJoystick(leftJoystick, touchInput.left);
        }
        if (touch.identifier === touchInput.right.identifier) {
            touchInput.right.active = false;
            touchInput.right.identifier = null;
            resetJoystick(rightJoystick, touchInput.right);
            touchInput.attack.active = false; // 右ジョイスティック離したら攻撃も止める
        }
        if (touch.identifier === touchInput.attack.identifier) {
            touchInput.attack.active = false;
            touchInput.attack.identifier = null;
            attackButton.style.transform = 'scale(1)';
        }
    }
}

function updateJoystick(joystickElement, touchData) {
    const areaRect = joystickElement.parentElement.getBoundingClientRect();
    const radius = areaRect.width / 2;
    const maxDisplacement = radius - joystickElement.offsetWidth / 2;

    let dx = touchData.currentX - touchData.startX;
    let dy = touchData.currentY - touchData.startY;
    const distance = Math.sqrt(dx * dx + dy * dy);

    if (distance > maxDisplacement) {
        dx = (dx / distance) * maxDisplacement;
        dy = (dy / distance) * maxDisplacement;
    }

    joystickElement.style.transform = `translate(${dx}px, ${dy}px)`;
    touchData.dx = dx;
    touchData.dy = dy;
}

function resetJoystick(joystickElement, touchData) {
    joystickElement.style.transform = 'translate(0px, 0px)';
    touchData.dx = 0;
    touchData.dy = 0;
}

// Passive event listeners for performance
canvas.addEventListener('touchstart', handleTouchStart, { passive: false });
canvas.addEventListener('touchmove', handleTouchMove, { passive: false });
canvas.addEventListener('touchend', handleTouchEnd, { passive: false });
canvas.addEventListener('touchcancel', handleTouchEnd, { passive: false });

document.getElementById('controls').addEventListener('touchstart', handleTouchStart, { passive: false });
document.getElementById('controls').addEventListener('touchmove', handleTouchMove, { passive: false });
document.getElementById('controls').addEventListener('touchend', handleTouchEnd, { passive: false });
document.getElementById('controls').addEventListener('touchcancel', handleTouchEnd, { passive: false });

// ボタンイベント
startButton.addEventListener('click', startGame);

showRankingButton.addEventListener('click', async () => {
    hideAllScreens();
    await displayRankings();
    rankingScreen.style.display = 'flex';
});

backToMenuButton.addEventListener('click', () => {
    hideAllScreens();
    startScreen.style.display = 'flex';
});

restartButton.addEventListener('click', startGame);

backToMenuFromGameOver.addEventListener('click', () => {
    hideAllScreens();
    startScreen.style.display = 'flex';
});

submitScoreButton.addEventListener('click', async () => {
    const playerName = playerNameInput.value.trim();
    if (!playerName) {
        alert('プレイヤー名を入力してください。');
        return;
    }
    localStorage.setItem('playerName', playerName); // 名前を保存

    let walletAddress = '';
    if (walletInput.style.display !== 'none') {
        walletAddress = walletInput.value.trim();
        if (walletAddress) {
            const validation = await verifyWalletAPI(walletAddress);
            if (!validation.valid) {
                walletError.textContent = validation.message || '無効なウォレットアドレスです。';
                walletError.style.display = 'block';
                return;
            } else {
                walletError.style.display = 'none';
            }
        } else if (gameState.currentRank > 0 && gameState.currentRank <= 3) {
            // トップ3なのにウォレット未入力の場合、確認するか、そのまま送信を許可するか
            // ここでは空のまま送信を許可
        }
    }

    submitScoreButton.disabled = true;
    submitScoreButton.textContent = '送信中...';

    try {
        await submitScoreAPI(
            playerName,
            gameState.score,
            gameState.level,
            gameState.stage,
            walletAddress
        );
        submitScoreButton.textContent = 'スコア送信完了！';
        // 送信後、ランキング画面に遷移するなど
        hideAllScreens();
        await displayRankings();
        rankingScreen.style.display = 'flex';

    } catch (error) {
        // エラーメッセージはAPI関数内でalert表示される想定
        submitScoreButton.textContent = 'スコアを登録';
        submitScoreButton.disabled = false;
    }
});

// ウィンドウリサイズ
window.addEventListener('resize', resizeCanvas);

// ==========================================================
// 8. 初期化処理
// ==========================================================

function init() {
    resizeCanvas();
    hideAllScreens();
    startScreen.style.display = 'flex';
}

init();
