/* ═══════════════════════════════════════════════════════════════════
   Game Theory Arena — Client-Side Application
   ═══════════════════════════════════════════════════════════════════ */

(() => {
    'use strict';

    // ── Socket ──────────────────────────────────────────────────────
    const socket = io();

    // ── DOM refs ────────────────────────────────────────────────────
    const $ = (s) => document.querySelector(s);
    const screens = {
        auth: $('#screen-auth'),
        home: $('#screen-home'),
        profile: $('#screen-profile'),
        leaderboard: $('#screen-leaderboard'),
        friends: $('#screen-friends'),
        searching: $('#screen-searching'),
        game: $('#screen-game'),
        results: $('#screen-results'),
        'ultimatum-proposer': $('#screen-ultimatum-proposer'),
        'ultimatum-responder': $('#screen-ultimatum-responder'),
        'ultimatum-result': $('#screen-ultimatum-result'),
        waiting: $('#screen-waiting'),
    };

    const dom = {
        navbar: $('#navbar'),

        // Auth
        loginForm: $('#form-login'),
        regForm: $('#form-register'),
        loginUser: $('#login-username'),
        loginPass: $('#login-password'),
        loginError: $('#login-error'),
        regUser: $('#reg-username'),
        regPass: $('#reg-password'),
        regError: $('#reg-error'),

        // Home
        homeGreeting: $('#home-greeting'),
        homeWins: $('#home-wins'),
        homeLosses: $('#home-losses'),
        homeDraws: $('#home-draws'),
        btnFindPD: $('#btn-find-pd'),
        btnFindUlt: $('#btn-find-ult'),

        // Profile
        profileAvatar: $('#profile-avatar'),
        profileUsername: $('#profile-username'),
        profileSince: $('#profile-since'),
        profileGames: $('#profile-games'),
        profileWins: $('#profile-wins'),
        profileLosses: $('#profile-losses'),
        profileDraws: $('#profile-draws'),
        profileScore: $('#profile-score'),
        profileWinrate: $('#profile-winrate'),

        // Leaderboard
        lbHint: $('#lb-hint'),
        lbTbody: $('#lb-tbody'),

        // Friends
        friendUsername: $('#friend-username'),
        btnAddFriend: $('#btn-add-friend'),
        friendMsg: $('#friend-msg'),
        friendRequestsSection: $('#friend-requests-section'),
        friendRequestsList: $('#friend-requests-list'),
        friendList: $('#friend-list'),
        friendsEmpty: $('#friends-empty'),

        // Searching
        btnCancel: $('#btn-cancel'),

        // Game
        youLabel: $('#you-label'),
        youScore: $('#you-score'),
        oppLabel: $('#opp-label'),
        oppScore: $('#opp-score'),
        roundNum: $('#round-num'),
        roundTotal: $('#round-total'),
        gamePrompt: $('#game-prompt'),
        choiceButtons: $('#choice-buttons'),
        waitingOverlay: $('#waiting-overlay'),
        roundReveal: $('#round-reveal'),
        revealYou: $('#reveal-you'),
        revealYouPts: $('#reveal-you-pts'),
        revealOpp: $('#reveal-opp'),
        revealOppName: $('#reveal-opp-name'),
        revealOppPts: $('#reveal-opp-pts'),
        btnNext: $('#btn-next'),
        historyBar: $('#history-bar'),

        // Results
        resultBanner: $('#result-banner'),
        resultEmoji: $('#result-emoji'),
        resultText: $('#result-text'),
        finalYouLabel: $('#final-you-label'),
        finalYouScore: $('#final-you-score'),
        finalOppLabel: $('#final-opp-label'),
        finalOppScore: $('#final-opp-score'),
        historyTbody: $('#history-tbody'),
        btnRematch: $('#btn-rematch'),
        btnBackHome: $('#btn-back-home'),
        rematchStatus: $('#rematch-status'),

        overlayDisconnect: $('#overlay-disconnect'),
        btnBackLobby: $('#btn-back-lobby'),
    };

    // ── State ───────────────────────────────────────────────────────
    let currentUser = null;
    let opponentName = '';
    let totalRounds = 5;
    let currentRound = 1;
    let isLastRound = false;
    let pendingResult = null;

    // ── Screen Management ───────────────────────────────────────────
    function showScreen(name) {
        Object.values(screens).forEach((s) => s.classList.remove('active'));
        if (screens[name]) screens[name].classList.add('active');

        // Show/hide navbar
        const showNav = name !== 'auth';
        dom.navbar.style.display = showNav ? 'flex' : 'none';
        document.body.classList.toggle('has-nav', showNav);

        // Active nav button
        document.querySelectorAll('.nav-btn[data-screen]').forEach((btn) => {
            btn.classList.toggle('active', btn.dataset.screen === name);
        });
    }

    // ══════════════════════════════════════════════════════════════════
    // AUTH
    // ══════════════════════════════════════════════════════════════════

    // Tab switching
    document.querySelectorAll('.auth-tab').forEach((tab) => {
        tab.addEventListener('click', () => {
            document.querySelectorAll('.auth-tab').forEach((t) => t.classList.remove('active'));
            tab.classList.add('active');
            dom.loginForm.style.display = tab.dataset.tab === 'login' ? 'block' : 'none';
            dom.regForm.style.display = tab.dataset.tab === 'register' ? 'block' : 'none';
            dom.loginError.textContent = '';
            dom.regError.textContent = '';
        });
    });

    // Login
    dom.loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        dom.loginError.textContent = '';
        try {
            const res = await fetch('/api/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    username: dom.loginUser.value.trim(),
                    password: dom.loginPass.value,
                    rememberMe: $('#login-remember').checked,
                }),
            });
            const data = await res.json();
            if (!res.ok) { dom.loginError.textContent = data.error; return; }
            currentUser = data;
            // Reconnect socket so it picks up the new session
            socket.disconnect();
            socket.connect();
            enterHome();
        } catch { dom.loginError.textContent = 'Connection error'; }
    });

    // Register
    dom.regForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        dom.regError.textContent = '';
        try {
            const res = await fetch('/api/register', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    username: dom.regUser.value.trim(),
                    password: dom.regPass.value,
                    rememberMe: $('#reg-remember').checked,
                }),
            });
            const data = await res.json();
            if (!res.ok) { dom.regError.textContent = data.error; return; }
            currentUser = data;
            // Reconnect socket so it picks up the new session
            socket.disconnect();
            socket.connect();
            enterHome();
        } catch { dom.regError.textContent = 'Connection error'; }
    });

    // Auto-login check
    async function checkSession() {
        try {
            const res = await fetch('/api/me');
            if (res.ok) {
                const data = await res.json();
                currentUser = { id: data.id, username: data.username };
                enterHome(data);
            } else {
                showScreen('auth');
            }
        } catch {
            showScreen('auth');
        }
    }
    checkSession();

    // Logout
    $('#nav-logout').addEventListener('click', async () => {
        await fetch('/api/logout', { method: 'POST' });
        currentUser = null;
        showScreen('auth');
        // Reconnect socket to clear identity
        socket.disconnect();
        socket.connect();
    });

    // ══════════════════════════════════════════════════════════════════
    // HOME
    // ══════════════════════════════════════════════════════════════════

    async function enterHome(preloadedData) {
        showScreen('home');
        let data = preloadedData;
        if (!data) {
            try {
                const res = await fetch('/api/me');
                data = await res.json();
            } catch { return; }
        }
        currentUser = { id: data.id, username: data.username };
        dom.homeGreeting.textContent = `Welcome, ${data.username}! 👋`;
        if (data.stats) {
            dom.homeWins.textContent = data.stats.wins || 0;
            dom.homeLosses.textContent = data.stats.losses || 0;
            dom.homeDraws.textContent = data.stats.draws || 0;
        }
    }

    // Nav buttons
    document.querySelectorAll('.nav-btn[data-screen]').forEach((btn) => {
        btn.addEventListener('click', () => {
            const screen = btn.dataset.screen;
            if (screen === 'home') enterHome();
            else if (screen === 'profile') loadProfile();
            else if (screen === 'leaderboard') loadLeaderboard();
            else if (screen === 'friends') loadFriends();
        });
    });

    // ══════════════════════════════════════════════════════════════════
    // PROFILE
    // ══════════════════════════════════════════════════════════════════

    async function loadProfile() {
        showScreen('profile');
        try {
            const res = await fetch('/api/me');
            const data = await res.json();
            dom.profileAvatar.textContent = data.username.charAt(0).toUpperCase();
            dom.profileUsername.textContent = data.username;
            dom.profileSince.textContent = `Member since ${new Date(data.created_at).toLocaleDateString()}`;
            const s = data.stats;
            dom.profileGames.textContent = s.games_played;
            dom.profileWins.textContent = s.wins;
            dom.profileLosses.textContent = s.losses;
            dom.profileDraws.textContent = s.draws;
            dom.profileScore.textContent = s.total_score;
            const rate = s.games_played > 0 ? Math.round((s.wins / s.games_played) * 100) : 0;
            dom.profileWinrate.textContent = rate + '%';
        } catch (err) {
            console.error('Profile load error', err);
        }
    }

    // ══════════════════════════════════════════════════════════════════
    // LEADERBOARD
    // ══════════════════════════════════════════════════════════════════

    let currentLbTab = 'global';

    // Tab switching
    document.querySelectorAll('.lb-tab').forEach((tab) => {
        tab.addEventListener('click', () => {
            document.querySelectorAll('.lb-tab').forEach((t) => t.classList.remove('active'));
            tab.classList.add('active');
            currentLbTab = tab.dataset.lb;
            renderLeaderboard();
        });
    });

    async function loadLeaderboard() {
        showScreen('leaderboard');
        renderLeaderboard();
    }

    async function renderLeaderboard() {
        try {
            const endpoint = currentLbTab === 'global' ? '/api/leaderboard/global' : '/api/leaderboard';
            const res = await fetch(endpoint);
            const rows = await res.json();
            dom.lbTbody.innerHTML = '';

            if (currentLbTab === 'friends' && rows.length <= 1) {
                dom.lbHint.style.display = 'block';
            } else {
                dom.lbHint.style.display = 'none';
            }

            rows.forEach((r) => {
                const tr = document.createElement('tr');
                if (currentUser && r.id === currentUser.id) tr.classList.add('lb-row-self');

                const rankEmoji = r.rank === 1 ? '🥇' : r.rank === 2 ? '🥈' : r.rank === 3 ? '🥉' : `${r.rank}`;
                tr.innerHTML = `
                    <td class="lb-rank">${rankEmoji}</td>
                    <td>${r.username}${currentUser && r.id === currentUser.id ? ' (you)' : ''}</td>
                    <td style="color: var(--cooperate)">${r.wins}</td>
                    <td style="color: var(--defect)">${r.losses}</td>
                    <td style="color: var(--draw-color)">${r.draws}</td>
                    <td style="color: var(--gold)">${r.total_score}</td>
                `;
                dom.lbTbody.appendChild(tr);
            });
        } catch (err) {
            console.error('Leaderboard load error', err);
        }
    }

    // ══════════════════════════════════════════════════════════════════
    // FRIENDS
    // ══════════════════════════════════════════════════════════════════

    dom.btnAddFriend.addEventListener('click', async () => {
        const username = dom.friendUsername.value.trim();
        if (!username) return;
        dom.friendMsg.textContent = '';
        dom.friendMsg.className = 'friend-msg';

        try {
            const res = await fetch('/api/friends/add', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username }),
            });
            const data = await res.json();
            if (!res.ok) {
                dom.friendMsg.textContent = data.error;
                dom.friendMsg.classList.add('error');
                return;
            }
            dom.friendMsg.textContent = data.message;
            dom.friendMsg.classList.add('success');
            dom.friendUsername.value = '';
            loadFriends();
        } catch {
            dom.friendMsg.textContent = 'Connection error';
            dom.friendMsg.classList.add('error');
        }
    });

    async function loadFriends() {
        showScreen('friends');
        try {
            const res = await fetch('/api/friends');
            const friends = await res.json();

            // Separate pending incoming and accepted/outgoing
            const incoming = friends.filter((f) => f.direction === 'incoming' && f.status === 'pending');
            const accepted = friends.filter((f) => f.status === 'accepted');
            const outgoing = friends.filter((f) => f.direction === 'outgoing' && f.status === 'pending');

            // Pending requests
            if (incoming.length > 0) {
                dom.friendRequestsSection.style.display = 'block';
                dom.friendRequestsList.innerHTML = '';
                incoming.forEach((f) => {
                    const div = document.createElement('div');
                    div.className = 'friend-item';
                    div.innerHTML = `
                        <div class="friend-item-info">
                            <div class="friend-avatar">${f.username.charAt(0).toUpperCase()}</div>
                            <span class="friend-name">${f.username}</span>
                        </div>
                        <button class="btn-accept" data-id="${f.id}">Accept</button>
                    `;
                    div.querySelector('.btn-accept').addEventListener('click', async () => {
                        await fetch('/api/friends/accept', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ userId: f.id }),
                        });
                        loadFriends();
                    });
                    dom.friendRequestsList.appendChild(div);
                });
            } else {
                dom.friendRequestsSection.style.display = 'none';
            }

            // Friend list
            dom.friendList.innerHTML = '';
            const allToShow = [...accepted, ...outgoing];

            if (allToShow.length === 0) {
                dom.friendList.innerHTML = '<p class="empty-hint">No friends yet. Add someone by username!</p>';
            } else {
                allToShow.forEach((f) => {
                    const div = document.createElement('div');
                    div.className = 'friend-item';
                    const statusClass = f.status === 'accepted' ? 'accepted' : 'pending';
                    const statusText = f.status === 'accepted' ? '✓ Friends' : 'Pending…';
                    div.innerHTML = `
                        <div class="friend-item-info">
                            <div class="friend-avatar">${f.username.charAt(0).toUpperCase()}</div>
                            <span class="friend-name">${f.username}</span>
                        </div>
                        <span class="friend-status ${statusClass}">${statusText}</span>
                    `;
                    dom.friendList.appendChild(div);
                });
            }
        } catch (err) {
            console.error('Friends load error', err);
        }
    }

    // ══════════════════════════════════════════════════════════════════
    // FORMAT HELPERS
    // ══════════════════════════════════════════════════════════════════

    const choiceEmoji = (c) => (c === 'cooperate' ? '🤝' : '🗡️');
    const choiceLabel = (c) => (c === 'cooperate' ? 'Cooperate' : 'Defect');

    function animateScore(el, to) {
        const from = parseInt(el.textContent, 10) || 0;
        if (from === to) { el.textContent = to; return; }
        const diff = to - from;
        const steps = 20;
        let step = 0;
        const timer = setInterval(() => {
            step++;
            el.textContent = Math.round(from + (diff * step / steps));
            if (step >= steps) { clearInterval(timer); el.textContent = to; }
        }, 25);
    }

    function resetGameUI() {
        dom.youScore.textContent = '0';
        dom.oppScore.textContent = '0';
        dom.roundNum.textContent = '1';
        dom.historyBar.innerHTML = '';
        dom.choiceButtons.style.display = 'flex';
        dom.waitingOverlay.classList.remove('show');
        dom.roundReveal.classList.remove('show');
        dom.gamePrompt.textContent = 'What will you do?';
        dom.rematchStatus.textContent = '';
        pendingResult = null;
        isLastRound = false;
    }

    // ══════════════════════════════════════════════════════════════════
    // MATCHMAKING
    // ══════════════════════════════════════════════════════════════════

    // Game mode selection buttons
    dom.btnFindPD?.addEventListener('click', () => {
        if (!currentUser) return;
        console.log('[DEBUG] Joining Prisoner\'s Dilemma queue');
        socket.emit('join-queue', 'prisoners_dilemma');
        showScreen('searching');
    });

    dom.btnFindUlt?.addEventListener('click', () => {
        if (!currentUser) return;
        console.log('[DEBUG] Joining Ultimatum queue');
        socket.emit('join-queue', 'ultimatum');
        showScreen('searching');
    });

    // ══════════════════════════════════════════════════════════════════
    // ULTIMATUM GAME
    // ══════════════════════════════════════════════════════════════════

    // Split slider interaction
    const splitSlider = $('#split-slider');
    const proposerSplitDisplay = $('#proposer-split');
    const responderSplitDisplay = $('#responder-split');

    splitSlider?.addEventListener('input', () => {
        const value = parseInt(splitSlider.value);
        proposerSplitDisplay.textContent = value;
        responderSplitDisplay.textContent = 10 - value;
    });

    // Propose split button
    $('#btn-propose')?.addEventListener('click', () => {
        const split = parseInt(splitSlider.value);
        socket.emit('propose-split', split);
    });

    // Proposal submitted confirmation
    socket.on('proposal-submitted', () => {
        showScreen('waiting');
    });

    // Accept/Reject buttons
    $('#btn-accept')?.addEventListener('click', () => {
        socket.emit('respond-to-proposal', true);
    });

    $('#btn-reject')?.addEventListener('click', () => {
        socket.emit('respond-to-proposal', false);
    });

    // Receive proposal (responder)
    socket.on('proposal-received', (data) => {
        $('#resp-proposer-split').textContent = data.proposerSplit;
        $('#resp-responder-split').textContent = data.responderSplit;
        showScreen('ultimatum-responder');
    });

    // Ultimatum round result
    socket.on('ultimatum-round-result', (data) => {
        const title = $('#ult-result-title');
        title.textContent = data.accepted ? 'ACCEPTED! ✓' : 'REJECTED! ✗';
        title.style.color = data.accepted ? 'var(--cooperate)' : 'var(--defect)';

        $('#ult-my-points').textContent = data.myPoints;
        $('#ult-opp-points').textContent = data.opponentPoints;
        $('#ult-my-score').textContent = data.myScore;
        $('#ult-opp-score').textContent = data.opponentScore;

        showScreen('ultimatum-result');
    });

    // Next round in Ultimatum game
    socket.on('ultimatum-next-round', (data) => {
        if (data.role === 'proposer') {
            // Reset slider to middle
            if (splitSlider) splitSlider.value = 5;
            if (proposerSplitDisplay) proposerSplitDisplay.textContent = '5';
            if (responderSplitDisplay) responderSplitDisplay.textContent = '5';
            showScreen('ultimatum-proposer');
        } else {
            // Responder waits for proposal
            showScreen('waiting');
        }
    });

    socket.on('queue-joined', () => showScreen('searching'));

    dom.btnCancel.addEventListener('click', () => {
        socket.disconnect();
        socket.connect();
        enterHome();
    });

    // ══════════════════════════════════════════════════════════════════
    // MATCH FOUND
    // ══════════════════════════════════════════════════════════════════

    socket.on('match-found', (data) => {
        opponentName = data.opponent;
        totalRounds = data.totalRounds;
        currentRound = data.round;

        if (data.gameMode === 'ultimatum') {
            // Ultimatum Game - show appropriate screen based on role
            if (data.role === 'proposer') {
                // Reset slider to default
                if (splitSlider) splitSlider.value = 5;
                if (proposerSplitDisplay) proposerSplitDisplay.textContent = '5';
                if (responderSplitDisplay) responderSplitDisplay.textContent = '5';
                showScreen('ultimatum-proposer');
            } else {
                // Responder waits for proposal
                showScreen('waiting');
            }
        } else {
            // Prisoner's Dilemma - existing logic
            resetGameUI();
            dom.youLabel.textContent = currentUser ? currentUser.username : 'You';
            dom.oppLabel.textContent = opponentName;
            dom.roundTotal.textContent = totalRounds;
            dom.roundNum.textContent = currentRound;
            showScreen('game');
        }
    });

    // ══════════════════════════════════════════════════════════════════
    // GAME — MAKE CHOICE
    // ══════════════════════════════════════════════════════════════════

    document.querySelectorAll('.btn-choice').forEach((btn) => {
        btn.addEventListener('click', () => {
            const choice = btn.dataset.choice;
            socket.emit('make-choice', choice);
            dom.choiceButtons.style.display = 'none';
            dom.waitingOverlay.classList.add('show');
        });
    });

    // ══════════════════════════════════════════════════════════════════
    // ROUND RESULT
    // ══════════════════════════════════════════════════════════════════

    socket.on('round-result', (data) => {
        pendingResult = data;

        dom.waitingOverlay.classList.remove('show');
        dom.roundReveal.classList.remove('show');
        void dom.roundReveal.offsetWidth;
        dom.roundReveal.classList.add('show');

        dom.revealYou.textContent = `${choiceEmoji(data.myChoice)} ${choiceLabel(data.myChoice)}`;
        dom.revealYouPts.textContent = `+${data.myPayoff}`;
        dom.revealYouPts.style.color = data.myPayoff > 0 ? 'var(--cooperate)' : 'var(--text-muted)';

        dom.revealOppName.textContent = opponentName;
        dom.revealOpp.textContent = `${choiceEmoji(data.opponentChoice)} ${choiceLabel(data.opponentChoice)}`;
        dom.revealOppPts.textContent = `+${data.opponentPayoff}`;
        dom.revealOppPts.style.color = data.opponentPayoff > 0 ? 'var(--defect)' : 'var(--text-muted)';

        animateScore(dom.youScore, data.myScore);
        animateScore(dom.oppScore, data.opponentScore);

        const pip = document.createElement('div');
        pip.className = 'history-pip';
        if (data.myPayoff > data.opponentPayoff) { pip.classList.add('win'); pip.textContent = `+${data.myPayoff}`; }
        else if (data.myPayoff < data.opponentPayoff) { pip.classList.add('loss'); pip.textContent = `+${data.myPayoff}`; }
        else { pip.classList.add('draw'); pip.textContent = `+${data.myPayoff}`; }
        dom.historyBar.appendChild(pip);

        isLastRound = (data.round >= totalRounds);
        dom.btnNext.textContent = isLastRound ? 'See Results →' : 'Next Round →';
    });

    // ── Next Round / See Results ────────────────────────────────────
    dom.btnNext.addEventListener('click', () => {
        dom.roundReveal.classList.remove('show');

        if (isLastRound) return;

        currentRound = pendingResult.round + 1;
        dom.roundNum.textContent = currentRound;
        dom.choiceButtons.style.display = 'flex';
        dom.gamePrompt.textContent = 'What will you do?';
    });

    // ══════════════════════════════════════════════════════════════════
    // MATCH RESULT
    // ══════════════════════════════════════════════════════════════════

    socket.on('match-result', (data) => {
        const { outcome, finalScores, history } = data;

        function showResults() {
            dom.resultBanner.className = 'result-banner ' + outcome;
            if (outcome === 'win') { dom.resultEmoji.textContent = '🏆'; dom.resultText.textContent = 'You Win!'; }
            else if (outcome === 'loss') { dom.resultEmoji.textContent = '😞'; dom.resultText.textContent = 'You Lose'; }
            else { dom.resultEmoji.textContent = '🤝'; dom.resultText.textContent = "It's a Draw!"; }

            const myId = currentUser.id;
            const oppId = Object.keys(finalScores).find((k) => k !== myId);
            dom.finalYouLabel.textContent = currentUser.username;
            dom.finalYouScore.textContent = finalScores[myId] ?? 0;
            dom.finalOppLabel.textContent = opponentName;
            dom.finalOppScore.textContent = finalScores[oppId] ?? 0;

            dom.historyTbody.innerHTML = '';
            if (history) {
                history.forEach((h, i) => {
                    const myChoice = h.choices[myId];
                    const oppChoice = h.choices[oppId];
                    const myPts = h.payoffs[myId];
                    const oppPts = h.payoffs[oppId];
                    const tr = document.createElement('tr');
                    tr.innerHTML = `
                        <td>${i + 1}</td>
                        <td class="${myChoice === 'cooperate' ? 'coop' : 'deft'}">${choiceEmoji(myChoice)}</td>
                        <td class="${oppChoice === 'cooperate' ? 'coop' : 'deft'}">${choiceEmoji(oppChoice)}</td>
                        <td>+${myPts}</td><td>+${oppPts}</td>
                    `;
                    dom.historyTbody.appendChild(tr);
                });
            }

            dom.rematchStatus.textContent = '';
            showScreen('results');
        }

        if (dom.roundReveal.classList.contains('show')) {
            const orig = dom.btnNext.onclick;
            dom.btnNext.addEventListener('click', () => showResults(), { once: true });
        } else {
            showResults();
        }
    });

    // ══════════════════════════════════════════════════════════════════
    // REMATCH & POST-GAME
    // ══════════════════════════════════════════════════════════════════

    dom.btnRematch.addEventListener('click', () => {
        socket.emit('rematch');
        dom.rematchStatus.textContent = 'Waiting for opponent…';
        dom.btnRematch.disabled = true;
    });

    socket.on('rematch-requested', () => {
        dom.rematchStatus.textContent = 'Opponent wants a rematch!';
    });

    dom.btnBackHome.addEventListener('click', () => {
        socket.disconnect();
        socket.connect();
        enterHome();
    });

    // ══════════════════════════════════════════════════════════════════
    // DISCONNECT
    // ══════════════════════════════════════════════════════════════════

    socket.on('opponent-disconnected', () => {
        dom.overlayDisconnect.classList.add('show');
    });

    dom.btnBackLobby.addEventListener('click', () => {
        dom.overlayDisconnect.classList.remove('show');
        socket.disconnect();
        socket.connect();
        enterHome();
    });

    socket.on('error-msg', (msg) => {
        console.error('Server error:', msg);
    });
})();
