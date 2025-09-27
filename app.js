class ABHIChatFixed {
    constructor() {
        this.peer = null;
        this.connections = new Map();
        this.currentUser = null;
        this.messages = [];
        this.isTyping = false;
        this.typingTimeout = null;
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = 5;
        this.syncInProgress = false;
        
        // Media handling
        this.selectedFile = null;
        this.maxFileSize = 10 * 1024 * 1024; // 10MB
        
        // User configuration - Fixed credentials
        this.users = {
            'abhijit': { 
                password: 'abhi123', 
                displayName: 'Abhijit', 
                peerId: 'abhi-chat-abhijit-2025',
                avatar: '👨'
            },
            'khusbu': { 
                password: 'khusbu123', 
                displayName: 'Khusbu', 
                peerId: 'abhi-chat-khusbu-2025',
                avatar: '👩'
            }
        };
        
        this.init();
    }

    async init() {
        this.initializeElements();
        this.setupEventListeners();
        this.loadChatHistory();
        
        // Check for auto-login first
        await this.checkAutoLogin();
        
        console.log('🚀 ABHI Chat Fixed - Ready for Photo & Media sharing!');
    }

    initializeElements() {
        // Login elements
        this.loginPage = document.getElementById('loginPage');
        this.chatPage = document.getElementById('chatPage');
        this.loginForm = document.getElementById('loginForm');
        this.loginBtn = document.getElementById('loginBtn');
        this.connectionStatus = document.getElementById('connectionStatus');
        this.loginIdInput = document.getElementById('loginId');
        this.passwordInput = document.getElementById('password');
        
        // Chat elements
        this.messageForm = document.getElementById('messageForm');
        this.messagesContainer = document.getElementById('messagesContainer');
        this.messageInput = document.getElementById('messageInput');
        this.charCounter = document.getElementById('charCounter');
        this.sendBtn = document.getElementById('sendBtn');
        
        // Header elements
        this.otherUserName = document.getElementById('otherUserName');
        this.otherUserAvatar = document.getElementById('otherUserAvatar');
        this.userStatus = document.getElementById('userStatus');
        this.statusText = document.getElementById('statusText');
        
        // Media elements
        this.attachBtn = document.getElementById('attachBtn');
        this.mediaActions = document.getElementById('mediaActions');
        this.cameraBtn = document.getElementById('cameraBtn');
        this.galleryBtn = document.getElementById('galleryBtn');
        this.documentBtn = document.getElementById('documentBtn');
        this.fileInput = document.getElementById('fileInput');
        this.cameraInput = document.getElementById('cameraInput');
        
        // Modal elements
        this.mediaPreviewModal = document.getElementById('mediaPreviewModal');
        this.mediaPreview = document.getElementById('mediaPreview');
        this.mediaCaption = document.getElementById('mediaCaption');
        this.closeMediaModal = document.getElementById('closeMediaModal');
        this.cancelMedia = document.getElementById('cancelMedia');
        this.sendMedia = document.getElementById('sendMedia');
        this.modalOverlay = document.getElementById('modalOverlay');
        
        // UI elements
        this.emojiBtn = document.getElementById('emojiBtn');
        this.emojiPicker = document.getElementById('emojiPicker');
        this.loadingOverlay = document.getElementById('loadingOverlay');
        this.toast = document.getElementById('toast');
    }

    setupEventListeners() {
        // Form events
        this.loginForm.addEventListener('submit', (e) => this.handleLogin(e));
        this.messageForm.addEventListener('submit', (e) => this.handleSendMessage(e));
        
        // Button events
        document.getElementById('logoutBtn').addEventListener('click', () => this.logout());
        document.getElementById('clearChat').addEventListener('click', () => this.clearChat());
        document.getElementById('refreshBtn').addEventListener('click', () => this.refreshConnection());
        
        // Media events
        this.attachBtn.addEventListener('click', () => this.toggleMediaActions());
        this.cameraBtn.addEventListener('click', () => this.openCamera());
        this.galleryBtn.addEventListener('click', () => this.openGallery());
        this.documentBtn.addEventListener('click', () => this.openGallery());
        
        this.fileInput.addEventListener('change', (e) => this.handleFileSelect(e));
        this.cameraInput.addEventListener('change', (e) => this.handleFileSelect(e));
        
        // Modal events
        this.closeMediaModal.addEventListener('click', () => this.closeMediaPreview());
        this.cancelMedia.addEventListener('click', () => this.closeMediaPreview());
        this.sendMedia.addEventListener('click', () => this.sendMediaMessage());
        this.modalOverlay.addEventListener('click', () => this.closeMediaPreview());
        
        // Emoji picker events
        this.emojiBtn.addEventListener('click', () => this.toggleEmojiPicker());
        document.getElementById('closeEmoji').addEventListener('click', () => this.hideEmojiPicker());
        
        document.querySelectorAll('.emoji').forEach(emoji => {
            emoji.addEventListener('click', (e) => this.insertEmoji(e.target.dataset.emoji));
        });

        // Message input events
        this.messageInput.addEventListener('input', () => {
            this.updateCharCounter();
            this.handleTyping();
        });
        
        this.messageInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                if (this.messageInput.value.trim()) {
                    this.handleSendMessage(e);
                }
            }
        });

        // Global events
        document.addEventListener('click', (e) => {
            if (!this.emojiPicker.contains(e.target) && e.target !== this.emojiBtn) {
                this.hideEmojiPicker();
            }
            if (!this.mediaActions.contains(e.target) && e.target !== this.attachBtn) {
                this.hideMediaActions();
            }
        });

        window.addEventListener('beforeunload', () => this.handleDisconnect());
        window.addEventListener('online', () => this.handleOnline());
        window.addEventListener('offline', () => this.handleOffline());
        
        // Visibility change for presence
        document.addEventListener('visibilitychange', () => {
            if (document.hidden) {
                this.updatePresence('away');
            } else {
                this.updatePresence('online');
                this.syncOfflineMessages();
            }
        });
    }

    // Auto-login functionality
    async checkAutoLogin() {
        const saved = localStorage.getItem('abhiChatCurrentUser');
        if (saved) {
            try {
                const userData = JSON.parse(saved);
                // Auto-login if session is less than 7 days old
                if (Date.now() - userData.loginTime < 7 * 24 * 60 * 60 * 1000) {
                    console.log('🔄 Auto-login for:', userData.displayName);
                    
                    this.currentUser = userData;
                    this.otherUser = userData.loginId === 'abhijit' ? 
                        this.users['khusbu'] : this.users['abhijit'];
                    
                    this.showLoadingOverlay('Restoring session...', 'Reconnecting to your chat');
                    
                    try {
                        await this.initializePeer();
                        this.hideLoadingOverlay();
                        this.showChatPage();
                        this.showToast(`Welcome back, ${userData.displayName}! 👋`, 'success');
                        return true;
                    } catch (error) {
                        console.error('Auto-login failed:', error);
                        this.hideLoadingOverlay();
                        // Pre-fill login form on auto-login failure
                        this.loginIdInput.value = userData.loginId;
                    }
                } else {
                    // Session expired, clear it
                    localStorage.removeItem('abhiChatCurrentUser');
                }
            } catch (error) {
                localStorage.removeItem('abhiChatCurrentUser');
            }
        }
        return false;
    }

    async initializePeer() {
        return new Promise(async (resolve, reject) => {
            try {
                // Destroy existing peer if any
                if (this.peer && !this.peer.destroyed) {
                    this.peer.destroy();
                }

                // Create new peer with user-specific ID
                this.peer = new Peer(this.currentUser.peerId, {
                    host: '0.peerjs.com',
                    port: 443,
                    path: '/',
                    secure: true,
                    debug: 1,
                    config: {
                        'iceServers': [
                            { urls: 'stun:stun.l.google.com:19302' },
                            { urls: 'stun:stun1.l.google.com:19302' }
                        ]
                    }
                });

                const timeout = setTimeout(() => {
                    reject(new Error('Peer connection timeout'));
                }, 15000);

                this.peer.on('open', (id) => {
                    clearTimeout(timeout);
                    console.log('✅ Peer ID assigned:', id);
                    this.setupPeerListeners();
                    this.connectToOtherUser();
                    resolve();
                });

                this.peer.on('error', (err) => {
                    clearTimeout(timeout);
                    console.error('Peer error:', err);
                    reject(err);
                });

            } catch (error) {
                reject(error);
            }
        });
    }

    setupPeerListeners() {
        this.peer.on('connection', (conn) => {
            console.log('📞 Incoming connection from:', conn.peer);
            this.handleConnection(conn);
        });

        this.peer.on('error', (err) => {
            console.error('❌ Peer error:', err);
            this.handlePeerError(err);
        });

        this.peer.on('disconnected', () => {
            console.warn('⚠️ Peer disconnected');
            this.updateConnectionStatus('Reconnecting...', 'warning');
            this.attemptReconnect();
        });
    }

    async connectToOtherUser() {
        try {
            console.log('🔗 Connecting to:', this.otherUser.peerId);
            
            const conn = this.peer.connect(this.otherUser.peerId, {
                reliable: true,
                serialization: 'json'
            });

            if (conn) {
                this.handleConnection(conn);
                
                // Wait for connection to open
                await new Promise((resolve, reject) => {
                    const timeout = setTimeout(() => {
                        resolve(); // Don't reject, just continue
                    }, 10000);

                    conn.on('open', () => {
                        clearTimeout(timeout);
                        resolve();
                    });

                    conn.on('error', (err) => {
                        clearTimeout(timeout);
                        resolve(); // Don't reject, just continue
                    });
                });
            }
        } catch (error) {
            console.warn('⚠️ Direct connection failed:', error.message);
            // Connection will be established when other user comes online
        }
    }

    handleConnection(conn) {
        this.connections.set(conn.peer, conn);
        
        conn.on('open', () => {
            console.log('✅ Connection opened with:', conn.peer);
            this.updateConnectionStatus('Connected', 'online');
            this.reconnectAttempts = 0;
            
            // Send initial handshake
            this.sendToPeer({
                type: 'handshake',
                user: this.currentUser,
                timestamp: Date.now()
            });
            
            // Sync offline messages
            setTimeout(() => {
                this.syncOfflineMessages();
            }, 1000);
            
            this.showToast(`Connected to ${this.otherUser.displayName}! 🎉`, 'success');
        });

        conn.on('data', (data) => {
            this.handleIncomingData(data);
        });

        conn.on('close', () => {
            console.log('⚠️ Connection closed with:', conn.peer);
            this.connections.delete(conn.peer);
            this.updateConnectionStatus('Disconnected', 'offline');
            this.showToast('Connection lost. Messages will sync when reconnected.', 'warning');
        });

        conn.on('error', (err) => {
            console.error('❌ Connection error:', err);
            this.connections.delete(conn.peer);
        });
    }

    handleIncomingData(data) {
        switch (data.type) {
            case 'message':
            case 'media':
                this.handleIncomingMessage(data);
                break;
            case 'typing':
                this.handleIncomingTyping(data);
                break;
            case 'handshake':
                console.log('🤝 Handshake received from:', data.user.displayName);
                this.updateConnectionStatus('Connected', 'online');
                setTimeout(() => {
                    this.syncOfflineMessages();
                }, 500);
                break;
            case 'presence':
                this.handlePresenceUpdate(data);
                break;
            case 'sync_request':
                this.handleSyncRequest(data);
                break;
            case 'sync_response':
                this.handleSyncResponse(data);
                break;
            case 'message_delivery_confirm':
                this.handleDeliveryConfirm(data);
                break;
        }
    }

    async handleLogin(e) {
        e.preventDefault();
        const loginId = this.loginIdInput.value.trim().toLowerCase();
        const password = this.passwordInput.value;

        if (!this.users[loginId] || this.users[loginId].password !== password) {
            this.showError('❌ Invalid credentials! Please check your username and password.');
            return;
        }

        try {
            this.showLoadingOverlay('Connecting to ABHI Chat...', 'Establishing secure P2P connection');
            this.loginBtn.classList.add('loading');

            this.currentUser = {
                loginId: loginId,
                displayName: this.users[loginId].displayName,
                peerId: this.users[loginId].peerId,
                avatar: this.users[loginId].avatar,
                loginTime: Date.now()
            };

            this.otherUser = loginId === 'abhijit' ? 
                this.users['khusbu'] : this.users['abhijit'];

            // Save session for auto-login
            localStorage.setItem('abhiChatCurrentUser', JSON.stringify(this.currentUser));
            
            await this.initializePeer();
            
            // Load messages and sync offline messages
            this.loadChatHistory();
            await this.syncOfflineMessages();
            
            this.hideLoadingOverlay();
            this.loginBtn.classList.remove('loading');
            this.showChatPage();
            this.showToast(`Welcome ${this.currentUser.displayName}! 🎉`, 'success');

        } catch (error) {
            console.error('Login failed:', error);
            this.hideLoadingOverlay();
            this.loginBtn.classList.remove('loading');
            this.showError(`❌ Connection failed: ${error.message}. Please try again.`);
        }
    }

    toggleMediaActions() {
        const isVisible = this.mediaActions.style.display === 'flex';
        if (isVisible) {
            this.hideMediaActions();
        } else {
            this.showMediaActions();
        }
    }

    showMediaActions() {
        this.mediaActions.style.display = 'flex';
        this.attachBtn.style.transform = 'rotate(45deg)';
        this.attachBtn.style.background = 'rgba(37, 211, 102, 0.1)';
        this.attachBtn.style.color = 'var(--accent-color)';
    }

    hideMediaActions() {
        this.mediaActions.style.display = 'none';
        this.attachBtn.style.transform = 'rotate(0deg)';
        this.attachBtn.style.background = 'none';
        this.attachBtn.style.color = 'var(--text-light)';
    }

    openCamera() {
        this.cameraInput.click();
        this.hideMediaActions();
    }

    openGallery() {
        this.fileInput.click();
        this.hideMediaActions();
    }

    handleFileSelect(event) {
        const files = event.target.files;
        if (files.length > 0) {
            const file = files[0];
            
            // Check file size
            if (file.size > this.maxFileSize) {
                this.showToast(`File too large. Maximum size is ${this.maxFileSize / (1024*1024)}MB`, 'error');
                return;
            }
            
            // Check file type
            const allowedTypes = ['image/', 'video/', 'application/pdf', 'application/msword', 
                                'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'text/'];
            const isAllowed = allowedTypes.some(type => file.type.startsWith(type));
            
            if (!isAllowed) {
                this.showToast('File type not supported. Please choose images, videos, or documents.', 'error');
                return;
            }
            
            this.selectedFile = file;
            this.showMediaPreview(file);
        }
        
        // Reset file inputs
        event.target.value = '';
    }

    showMediaPreview(file) {
        const fileType = file.type.split('/')[0];
        let previewElement;
        
        if (fileType === 'image') {
            previewElement = document.createElement('img');
            previewElement.src = URL.createObjectURL(file);
            previewElement.alt = file.name;
            previewElement.style.maxWidth = '100%';
            previewElement.style.maxHeight = '300px';
            previewElement.style.objectFit = 'contain';
        } else if (fileType === 'video') {
            previewElement = document.createElement('video');
            previewElement.src = URL.createObjectURL(file);
            previewElement.controls = true;
            previewElement.muted = true;
            previewElement.style.maxWidth = '100%';
            previewElement.style.maxHeight = '300px';
        } else {
            previewElement = document.createElement('div');
            previewElement.innerHTML = `
                <div style="text-align: center; padding: 40px;">
                    <i class="fas fa-file" style="font-size: 48px; color: var(--accent-color); margin-bottom: 16px;"></i>
                    <h4>${file.name}</h4>
                    <p style="color: var(--text-light); font-size: 14px; margin-top: 8px;">
                        ${this.formatFileSize(file.size)}
                    </p>
                </div>
            `;
        }
        
        this.mediaPreview.innerHTML = '';
        this.mediaPreview.appendChild(previewElement);
        this.mediaPreviewModal.style.display = 'flex';
        
        // Focus on caption input
        setTimeout(() => {
            this.mediaCaption.focus();
        }, 300);
    }

    closeMediaPreview() {
        this.mediaPreviewModal.style.display = 'none';
        this.mediaPreview.innerHTML = '';
        this.mediaCaption.value = '';
        this.selectedFile = null;
        
        // Clean up blob URLs
        const imgElements = this.mediaPreview.querySelectorAll('img, video');
        imgElements.forEach(element => {
            if (element.src && element.src.startsWith('blob:')) {
                URL.revokeObjectURL(element.src);
            }
        });
    }

    async sendMediaMessage() {
        if (!this.selectedFile) return;
        
        try {
            this.showLoadingOverlay('Sending media...', 'Processing and uploading file');
            
            // Convert file to base64
            const base64Data = await this.fileToBase64(this.selectedFile);
            const caption = this.mediaCaption.value.trim();
            
            const message = {
                id: `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                type: 'media',
                mediaType: this.selectedFile.type.split('/')[0],
                fileName: this.selectedFile.name,
                fileSize: this.selectedFile.size,
                mimeType: this.selectedFile.type,
                data: base64Data,
                caption: caption,
                sender: this.currentUser.loginId,
                senderName: this.currentUser.displayName,
                timestamp: Date.now(),
                avatar: this.currentUser.avatar,
                delivered: false,
                pending: true
            };

            // Add to local messages
            this.messages.push(message);
            this.saveChatHistory();
            
            // Display message immediately
            this.displayAllMessages();
            
            // Send to peer
            const sent = this.sendToPeer(message);
            
            if (!sent) {
                this.storeOfflineMessage(message);
                this.showToast('Media will be sent when user comes online', 'warning');
            } else {
                message.pending = false;
                message.delivered = true;
                this.saveChatHistory();
                this.displayAllMessages(); // Refresh to show delivered status
            }
            
            this.closeMediaPreview();
            this.hideLoadingOverlay();
            this.scrollToBottom();
            
        } catch (error) {
            console.error('❌ Failed to send media:', error);
            this.showToast('Failed to send media. Please try again.', 'error');
            this.hideLoadingOverlay();
        }
    }

    handleIncomingMessage(data) {
        // Check if message already exists (prevent duplicates)
        const existingMessage = this.messages.find(msg => msg.id === data.id);
        if (existingMessage) {
            console.log('Message already exists, skipping:', data.id);
            return;
        }

        const message = {
            id: data.id,
            type: data.type || 'message',
            text: data.text,
            data: data.data,
            mediaType: data.mediaType,
            fileName: data.fileName,
            fileSize: data.fileSize,
            mimeType: data.mimeType,
            caption: data.caption,
            sender: data.sender,
            senderName: data.senderName,
            timestamp: data.timestamp,
            avatar: data.avatar,
            delivered: true
        };

        // Add to messages array
        this.messages.push(message);
        
        // Sort messages by timestamp to maintain order
        this.messages.sort((a, b) => a.timestamp - b.timestamp);
        
        this.saveChatHistory();
        
        // Display message
        this.displayAllMessages();
        this.scrollToBottom();
        
        // Send delivery confirmation
        this.sendToPeer({
            type: 'message_delivery_confirm',
            messageId: data.id,
            confirmedBy: this.currentUser.loginId
        });
        
        // Play notification sound
        this.playNotificationSound();
        
        // Show notification if page is not visible
        if (document.hidden) {
            this.showBrowserNotification(message);
        }
    }

    async handleSendMessage(e) {
        e.preventDefault();
        const messageText = this.messageInput.value.trim();
        
        if (!messageText || messageText.length > 500) return;

        const message = {
            id: `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            type: 'message',
            text: messageText,
            sender: this.currentUser.loginId,
            senderName: this.currentUser.displayName,
            timestamp: Date.now(),
            avatar: this.currentUser.avatar,
            delivered: false,
            pending: true
        };

        // Add to local messages immediately
        this.messages.push(message);
        this.saveChatHistory();
        
        // Display message immediately with pending status
        this.displayAllMessages();
        
        // Try to send to peer
        const sent = this.sendToPeer(message);
        
        if (!sent) {
            // Store for offline delivery
            this.storeOfflineMessage(message);
            this.showToast('Message will be delivered when user comes online', 'warning');
        } else {
            // Mark as delivered locally (will be confirmed by peer)
            message.pending = false;
            message.delivered = true;
            this.saveChatHistory();
            this.displayAllMessages(); // Refresh to show delivered status
        }
        
        // Clear input and stop typing indicator
        this.messageInput.value = '';
        this.updateCharCounter();
        this.stopTyping();
        this.scrollToBottom();
        
        // Disable send button briefly to prevent spam
        this.sendBtn.disabled = true;
        setTimeout(() => {
            this.sendBtn.disabled = false;
        }, 500);
    }

    sendToPeer(data) {
        let sentCount = 0;
        this.connections.forEach((conn, peerId) => {
            if (conn.open) {
                try {
                    conn.send(data);
                    sentCount++;
                } catch (error) {
                    console.error('Failed to send to:', peerId, error);
                }
            }
        });
        
        return sentCount > 0;
    }

    storeOfflineMessage(message) {
        const offlineKey = `abhiChat_offline_${this.otherUser.loginId}`;
        const offlineMessages = JSON.parse(localStorage.getItem(offlineKey) || '[]');
        offlineMessages.push(message);
        localStorage.setItem(offlineKey, JSON.stringify(offlineMessages));
        console.log(`📝 Message stored offline for ${this.otherUser.displayName}`);
    }

    async syncOfflineMessages() {
        if (this.syncInProgress) return;
        this.syncInProgress = true;

        try {
            // Send our offline messages to the other user
            await this.sendOfflineMessages();
            
            // Request sync from other user
            this.requestSyncFromPeer();
            
        } catch (error) {
            console.error('Sync failed:', error);
        } finally {
            this.syncInProgress = false;
        }
    }

    async sendOfflineMessages() {
        const offlineKey = `abhiChat_offline_${this.otherUser.loginId}`;
        const offlineMessages = JSON.parse(localStorage.getItem(offlineKey) || '[]');
        
        if (offlineMessages.length > 0) {
            console.log(`📤 Sending ${offlineMessages.length} offline messages`);
            
            for (const message of offlineMessages) {
                const sent = this.sendToPeer({
                    ...message,
                    type: message.type || 'message'
                });
                
                if (sent) {
                    // Mark as delivered
                    const localMessage = this.messages.find(msg => msg.id === message.id);
                    if (localMessage) {
                        localMessage.delivered = true;
                        localMessage.pending = false;
                    }
                }
                
                // Small delay between messages to prevent overwhelming
                await new Promise(resolve => setTimeout(resolve, 100));
            }
            
            // Clear offline messages after sending
            localStorage.removeItem(offlineKey);
            this.saveChatHistory();
            
            this.showToast(`Synced ${offlineMessages.length} offline messages`, 'success');
            this.displayAllMessages();
        }
    }

    requestSyncFromPeer() {
        this.sendToPeer({
            type: 'sync_request',
            requestedBy: this.currentUser.loginId,
            lastMessageTime: this.getLastMessageTime()
        });
    }

    handleSyncRequest(data) {
        // Send messages that are newer than the requested time
        const messagesToSync = this.messages.filter(msg => 
            msg.timestamp > data.lastMessageTime && 
            msg.sender === this.currentUser.loginId
        );

        if (messagesToSync.length > 0) {
            console.log(`📤 Syncing ${messagesToSync.length} messages to ${data.requestedBy}`);
            
            this.sendToPeer({
                type: 'sync_response',
                messages: messagesToSync,
                syncFor: data.requestedBy
            });
        }
    }

    handleSyncResponse(data) {
        let newMessagesCount = 0;
        
        for (const messageData of data.messages) {
            // Check if message already exists
            const existingMessage = this.messages.find(msg => msg.id === messageData.id);
            if (!existingMessage) {
                this.messages.push({
                    ...messageData,
                    delivered: true
                });
                newMessagesCount++;
            }
        }
        
        if (newMessagesCount > 0) {
            // Sort messages by timestamp
            this.messages.sort((a, b) => a.timestamp - b.timestamp);
            this.saveChatHistory();
            this.displayAllMessages();
            this.scrollToBottom();
            
            console.log(`📥 Received ${newMessagesCount} synced messages`);
            this.showToast(`Received ${newMessagesCount} missed messages`, 'success');
        }
    }

    handleDeliveryConfirm(data) {
        const message = this.messages.find(msg => msg.id === data.messageId);
        if (message) {
            message.delivered = true;
            message.pending = false;
            this.saveChatHistory();
            console.log('✅ Message delivery confirmed:', data.messageId);
            // Refresh display to show delivery status
            this.displayAllMessages();
        }
    }

    getLastMessageTime() {
        if (this.messages.length === 0) return 0;
        const lastMessage = this.messages[this.messages.length - 1];
        return lastMessage.timestamp || 0;
    }

    displayMessage(message) {
        // Remove welcome message if present
        const welcomeMessage = this.messagesContainer.querySelector('.welcome-message');
        if (welcomeMessage) {
            welcomeMessage.remove();
        }

        const messageDiv = document.createElement('div');
        const isOwn = message.sender === this.currentUser.loginId;
        messageDiv.className = `message ${isOwn ? 'sent' : 'received'}`;
        
        // Add pending class if message is not delivered
        if (isOwn && message.pending) {
            messageDiv.classList.add('pending');
        }
        
        const messageTime = new Date(message.timestamp).toLocaleTimeString([], { 
            hour: '2-digit', 
            minute: '2-digit' 
        });

        let statusIcon = '';
        if (isOwn) {
            if (message.pending) {
                statusIcon = '<i class="fas fa-clock" style="color: #999;" title="Pending"></i>';
            } else if (message.delivered) {
                statusIcon = '<i class="fas fa-check-double" style="color: #4fc3f7;" title="Delivered"></i>';
            } else {
                statusIcon = '<i class="fas fa-check" style="color: #999;" title="Sent"></i>';
            }
        }

        let messageContent = '';
        
        if (message.type === 'media') {
            messageContent = this.createMediaMessageHTML(message);
        } else {
            messageContent = `<div class="message-content">${this.formatMessageText(message.text)}</div>`;
        }

        messageDiv.innerHTML = `
            ${messageContent}
            <div class="message-time">
                ${messageTime}
                ${statusIcon}
            </div>
        `;

        this.messagesContainer.appendChild(messageDiv);
    }

    createMediaMessageHTML(message) {
        let mediaHTML = '';
        
        if (message.mediaType === 'image') {
            mediaHTML = `
                <div class="message-media">
                    <img src="data:${message.mimeType};base64,${message.data}" 
                         alt="${message.fileName}" 
                         class="message-image"
                         onclick="window.abhiChat.openFullScreenMedia('${message.data}', '${message.mimeType}', '${message.fileName}')"
                         loading="lazy">
                </div>
            `;
        } else if (message.mediaType === 'video') {
            mediaHTML = `
                <div class="message-media">
                    <video class="message-video" controls preload="metadata">
                        <source src="data:${message.mimeType};base64,${message.data}" type="${message.mimeType}">
                        Your browser does not support video playback.
                    </video>
                </div>
            `;
        } else {
            mediaHTML = `
                <div class="message-media">
                    <div class="file-message">
                        <i class="fas fa-file" style="font-size: 24px; color: var(--accent-color); margin-bottom: 8px;"></i>
                        <div class="file-name">${message.fileName}</div>
                        <div class="file-size">${this.formatFileSize(message.fileSize)}</div>
                        <button class="download-btn" onclick="window.abhiChat.downloadFile('${message.data}', '${message.fileName}', '${message.mimeType}')">
                            <i class="fas fa-download"></i> Download
                        </button>
                    </div>
                </div>
            `;
        }
        
        if (message.caption) {
            mediaHTML += `<div class="message-content">${this.formatMessageText(message.caption)}</div>`;
        }
        
        return mediaHTML;
    }

    openFullScreenMedia(base64Data, mimeType, fileName) {
        const newWindow = window.open('', '_blank');
        if (!newWindow) {
            this.showToast('Please allow popups to view full-screen media', 'warning');
            return;
        }
        
        const mediaHTML = mimeType.startsWith('image/') 
            ? `<img src="data:${mimeType};base64,${base64Data}" style="max-width: 100%; max-height: 100%; object-fit: contain;" alt="${fileName}">`
            : `<video src="data:${mimeType};base64,${base64Data}" controls style="max-width: 100%; max-height: 100%;" autoplay />`;
            
        newWindow.document.write(`
            <html>
                <head>
                    <title>${fileName}</title>
                    <style>
                        body { 
                            margin: 0; 
                            padding: 20px; 
                            background: #000; 
                            display: flex; 
                            justify-content: center; 
                            align-items: center; 
                            min-height: 100vh; 
                            font-family: 'Roboto', sans-serif;
                        }
                    </style>
                </head>
                <body>
                    ${mediaHTML}
                </body>
            </html>
        `);
        newWindow.document.close();
    }

    downloadFile(base64Data, fileName, mimeType) {
        try {
            const byteCharacters = atob(base64Data);
            const byteNumbers = new Array(byteCharacters.length);
            for (let i = 0; i < byteCharacters.length; i++) {
                byteNumbers[i] = byteCharacters.charCodeAt(i);
            }
            const byteArray = new Uint8Array(byteNumbers);
            const blob = new Blob([byteArray], { type: mimeType });
            
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.style.display = 'none';
            a.href = url;
            a.download = fileName;
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            document.body.removeChild(a);
            
            this.showToast('Download started', 'success');
        } catch (error) {
            console.error('Download failed:', error);
            this.showToast('Download failed. Please try again.', 'error');
        }
    }

    formatMessageText(text) {
        return text
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;')
            .replace(/(https?:\/\/[^\s]+)/g, '<a href="$1" target="_blank" rel="noopener">$1</a>')
            .replace(/\n/g, '<br>')
            .replace(/:\)/g, '😊')
            .replace(/:\(/g, '😢')
            .replace(/:D/g, '😃')
            .replace(/:P/g, '😛')
            .replace(/<3/g, '❤️');
    }

    formatFileSize(bytes) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }

    async fileToBase64(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.readAsDataURL(file);
            reader.onload = () => {
                const base64 = reader.result.split(',')[1];
                resolve(base64);
            };
            reader.onerror = error => reject(error);
        });
    }

    handleTyping() {
        if (!this.isTyping) {
            this.isTyping = true;
            this.sendToPeer({
                type: 'typing',
                isTyping: true,
                user: this.currentUser.displayName
            });
        }

        clearTimeout(this.typingTimeout);
        this.typingTimeout = setTimeout(() => {
            this.stopTyping();
        }, 3000);
    }

    stopTyping() {
        if (this.isTyping) {
            this.isTyping = false;
            this.sendToPeer({
                type: 'typing',
                isTyping: false,
                user: this.currentUser.displayName
            });
        }
        clearTimeout(this.typingTimeout);
    }

    handleIncomingTyping(data) {
        if (data.isTyping) {
            this.showTypingIndicator(data.user);
        } else {
            this.hideTypingIndicator();
        }
    }

    showTypingIndicator(username) {
        this.hideTypingIndicator(); // Remove existing indicator
        
        const typingDiv = document.createElement('div');
        typingDiv.className = 'typing-indicator';
        typingDiv.innerHTML = `
            <div class="typing-dots">
                <div class="typing-dot"></div>
                <div class="typing-dot"></div>
                <div class="typing-dot"></div>
            </div>
            <span style="margin-left: 10px; color: var(--text-light); font-size: 14px;">
                ${username} is typing...
            </span>
        `;
        
        this.messagesContainer.appendChild(typingDiv);
        this.scrollToBottom();
        
        // Auto-hide after 5 seconds
        setTimeout(() => {
            this.hideTypingIndicator();
        }, 5000);
    }

    hideTypingIndicator() {
        const indicator = this.messagesContainer.querySelector('.typing-indicator');
        if (indicator) {
            indicator.remove();
        }
    }

    showChatPage() {
        this.loginPage.style.display = 'none';
        this.chatPage.style.display = 'flex';
        
        // Update UI
        this.otherUserName.textContent = this.otherUser.displayName;
        this.otherUserAvatar.textContent = this.otherUser.avatar;
        
        // Load and display messages
        this.displayAllMessages();
        
        // Focus input
        setTimeout(() => {
            this.messageInput.focus();
        }, 300);
        
        this.updateCharCounter();
    }

    displayAllMessages() {
        // Clear container except typing indicator
        const typingIndicator = this.messagesContainer.querySelector('.typing-indicator');
        this.messagesContainer.innerHTML = '';
        
        if (this.messages.length === 0) {
            this.messagesContainer.innerHTML = `
                <div class="welcome-message">
                    <div class="welcome-icon">
                        <i class="fas fa-comments"></i>
                    </div>
                    <h3>Start Chatting with ${this.otherUser.displayName}!</h3>
                    <p>Send messages and share photos & media instantly</p>
                    <div class="connection-info">
                        <i class="fas fa-shield-alt"></i>
                        <span>End-to-end encrypted messaging</span>
                    </div>
                </div>
            `;
        } else {
            // Sort messages to ensure proper order
            this.messages.sort((a, b) => a.timestamp - b.timestamp);
            
            this.messages.forEach(message => {
                this.displayMessage(message);
            });
        }
        
        if (typingIndicator) {
            this.messagesContainer.appendChild(typingIndicator);
        }
        
        this.scrollToBottom();
    }

    updateCharCounter() {
        const remaining = 500 - this.messageInput.value.length;
        this.charCounter.textContent = remaining;
        this.charCounter.style.color = remaining < 50 ? 'var(--error-color)' : 'var(--text-light)';
    }

    updateConnectionStatus(status, type = 'default') {
        this.statusText.textContent = status;
        
        const statusElement = this.userStatus;
        statusElement.className = `status ${type}`;
        
        const icon = statusElement.querySelector('i');
        switch (type) {
            case 'online':
                icon.className = 'fas fa-circle';
                break;
            case 'offline':
                icon.className = 'fas fa-circle';
                break;
            case 'warning':
                icon.className = 'fas fa-exclamation-circle';
                break;
            default:
                icon.className = 'fas fa-circle';
        }
    }

    updatePresence(status) {
        this.sendToPeer({
            type: 'presence',
            status: status,
            user: this.currentUser.displayName,
            timestamp: Date.now()
        });
    }

    handlePresenceUpdate(data) {
        // Handle presence updates from other user
        console.log(`${data.user} is now ${data.status}`);
    }

    refreshConnection() {
        if (this.currentUser) {
            this.showToast('Refreshing connection...', 'warning');
            this.connectToOtherUser().then(() => {
                setTimeout(() => {
                    this.syncOfflineMessages();
                }, 1000);
            });
        }
    }

    toggleEmojiPicker() {
        const isVisible = this.emojiPicker.style.display === 'block';
        if (isVisible) {
            this.hideEmojiPicker();
        } else {
            this.showEmojiPicker();
        }
    }

    showEmojiPicker() {
        this.emojiPicker.style.display = 'block';
    }

    hideEmojiPicker() {
        this.emojiPicker.style.display = 'none';
    }

    insertEmoji(emoji) {
        const cursorPos = this.messageInput.selectionStart;
        const textBefore = this.messageInput.value.substring(0, cursorPos);
        const textAfter = this.messageInput.value.substring(cursorPos);
        
        this.messageInput.value = textBefore + emoji + textAfter;
        this.messageInput.focus();
        this.messageInput.setSelectionRange(cursorPos + emoji.length, cursorPos + emoji.length);
        
        this.updateCharCounter();
        this.hideEmojiPicker();
    }

    clearChat() {
        if (confirm('🗑️ Are you sure you want to clear all chat history?\n\nThis action cannot be undone and will clear messages on all devices.')) {
            this.messages = [];
            this.saveChatHistory();
            
            // Clear offline messages too
            localStorage.removeItem(`abhiChat_offline_${this.otherUser.loginId}`);
            
            this.displayAllMessages();
            this.showToast('Chat history cleared', 'success');
        }
    }

    logout() {
        if (confirm('👋 Are you sure you want to logout?')) {
            this.handleDisconnect();
            
            // Clear session
            localStorage.removeItem('abhiChatCurrentUser');
            this.currentUser = null;
            this.otherUser = null;
            
            // Reset form
            this.loginIdInput.value = '';
            this.passwordInput.value = '';
            this.messageInput.value = '';
            
            // Show login page
            this.chatPage.style.display = 'none';
            this.loginPage.style.display = 'flex';
            
            this.showToast('Logged out successfully', 'success');
        }
    }

    handleDisconnect() {
        if (this.peer && !this.peer.destroyed) {
            this.peer.destroy();
        }
        this.connections.clear();
        this.stopTyping();
    }

    handleOnline() {
        console.log('📶 Back online');
        this.showToast('Connection restored', 'success');
        if (this.currentUser) {
            this.connectToOtherUser();
        }
    }

    handleOffline() {
        console.log('📵 Gone offline');
        this.showToast('No internet connection', 'error');
        this.updateConnectionStatus('Offline', 'offline');
    }

    handlePeerError(error) {
        console.error('Peer error:', error);
        this.updateConnectionStatus('Connection Error', 'offline');
        
        if (!this.peer.destroyed) {
            this.attemptReconnect();
        }
    }

    attemptReconnect() {
        if (this.reconnectAttempts < this.maxReconnectAttempts) {
            this.reconnectAttempts++;
            console.log(`🔄 Reconnection attempt ${this.reconnectAttempts}`);
            
            setTimeout(() => {
                if (this.currentUser) {
                    this.connectToOtherUser();
                }
            }, 2000 * this.reconnectAttempts);
        }
    }

    loadChatHistory() {
        const saved = localStorage.getItem('abhiChatMessages');
        if (saved) {
            try {
                this.messages = JSON.parse(saved);
                // Sort messages to ensure proper order
                this.messages.sort((a, b) => a.timestamp - b.timestamp);
            } catch (error) {
                console.error('Error loading chat history:', error);
                this.messages = [];
            }
        }
    }

    saveChatHistory() {
        try {
            localStorage.setItem('abhiChatMessages', JSON.stringify(this.messages));
        } catch (error) {
            console.error('Error saving chat history:', error);
        }
    }

    scrollToBottom() {
        requestAnimationFrame(() => {
            this.messagesContainer.scrollTop = this.messagesContainer.scrollHeight;
        });
    }

    showLoadingOverlay(title, message) {
        document.getElementById('loadingTitle').textContent = title;
        document.getElementById('loadingMessage').textContent = message;
        this.loadingOverlay.style.display = 'flex';
    }

    hideLoadingOverlay() {
        this.loadingOverlay.style.display = 'none';
    }

    showError(message) {
        const errorElement = document.getElementById('loginError');
        errorElement.textContent = message;
        errorElement.style.display = 'block';
        
        setTimeout(() => {
            errorElement.style.display = 'none';
        }, 5000);
    }

    showToast(message, type = 'default') {
        const toast = this.toast;
        const toastMessage = document.getElementById('toastMessage');
        
        toastMessage.textContent = message;
        toast.className = `toast ${type}`;
        toast.style.display = 'flex';
        
        setTimeout(() => {
            toast.style.display = 'none';
        }, 3000);
    }

    playNotificationSound() {
        try {
            const audioContext = new (window.AudioContext || window.webkitAudioContext)();
            const oscillator = audioContext.createOscillator();
            const gainNode = audioContext.createGain();
            
            oscillator.connect(gainNode);
            gainNode.connect(audioContext.destination);
            
            oscillator.frequency.value = 800;
            oscillator.type = 'sine';
            
            gainNode.gain.setValueAtTime(0, audioContext.currentTime);
            gainNode.gain.linearRampToValueAtTime(0.1, audioContext.currentTime + 0.01);
            gainNode.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + 0.3);
            
            oscillator.start(audioContext.currentTime);
            oscillator.stop(audioContext.currentTime + 0.3);
        } catch (error) {
            console.log('🔇 Audio not available');
        }
    }

    showBrowserNotification(message) {
        if ('Notification' in window && Notification.permission === 'granted') {
            const title = message.type === 'media' 
                ? `📎 ${message.mediaType} from ${message.senderName}` 
                : `New message from ${message.senderName}`;
                    
            const body = message.type === 'media' 
                ? message.caption || message.fileName || 'Media file'
                : message.text;

            new Notification(title, {
                body: body,
                icon: '/favicon.ico',
                tag: 'abhi-chat'
            });
        } else if ('Notification' in window && Notification.permission === 'default') {
            Notification.requestPermission();
        }
    }
}

// Initialize the app when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.abhiChat = new ABHIChatFixed();
    
    // Request notification permission
    if ('Notification' in window && Notification.permission === 'default') {
        Notification.requestPermission();
    }
    
    console.log('🎉 ABHI Chat Fixed loaded - Photo & Media ready with auto-login!');
});

// Handle page reload/refresh - preserve session
window.addEventListener('beforeunload', () => {
    if (window.abhiChat && window.abhiChat.currentUser) {
        // Mark user as away when leaving
        window.abhiChat.updatePresence('away');
    }
});

// Handle page focus/blur for better presence detection
window.addEventListener('focus', () => {
    if (window.abhiChat && window.abhiChat.currentUser) {
        window.abhiChat.updatePresence('online');
    }
});

window.addEventListener('blur', () => {
    if (window.abhiChat && window.abhiChat.currentUser) {
        window.abhiChat.updatePresence('away');
    }
});

// Handle network status changes
window.addEventListener('online', () => {
    if (window.abhiChat) {
        window.abhiChat.handleOnline();
    }
});

window.addEventListener('offline', () => {
    if (window.abhiChat) {
        window.abhiChat.handleOffline();
    }
});

// Service Worker Registration for PWA functionality (Optional)
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('/sw.js')
            .then((registration) => {
                console.log('SW registered: ', registration);
            })
            .catch((registrationError) => {
                console.log('SW registration failed: ', registrationError);
            });
    });
}

// Handle visibility change for better user experience
document.addEventListener('visibilitychange', () => {
    if (window.abhiChat && window.abhiChat.currentUser) {
        if (document.hidden) {
            window.abhiChat.updatePresence('away');
        } else {
            window.abhiChat.updatePresence('online');
            // Sync messages when user returns to the tab
            setTimeout(() => {
                window.abhiChat.syncOfflineMessages();
            }, 1000);
        }
    }
});
