import { makeObservable } from "picosm";

/**
 * Store for managing users in the editor (current user and remote collaborators)
 */
export class UserStore {
  static observableActions = [
    'setCurrentUser',
    'updateCurrentUser',
    'addUser',
    'removeUser',
    'updateUser',
    'setUserPresence',
    'clearUsers',
    'setUsers',
    'updateUserActivity'
  ];
  
  static computedProperties = [
    'allUsers',
    'activeUsers',
    'currentUserInfo',
    'usersList',
    'usersByEmail',
    'onlineUsers',
    'offlineUsers'
  ];

  // Current user information
  currentUser = {
    email: '',
    displayName: '',
    avatar: '',
    color: '', // Unique color for user indicators
    isActive: true,
    lastActivity: new Date()
  };

  // All users map (email -> user info) - excluding current user
  users = new Map();

  // User presence tracking (email -> presence info)
  userPresence = new Map();

  /**
   * Set the current user
   */
  setCurrentUser(email, displayName = '') {
    // Generate a color based on email for consistency
    const color = this.generateUserColor(email);
    
    this.currentUser = {
      email,
      displayName: displayName || this.extractNameFromEmail(email),
      avatar: '', // No avatar support - using initials instead
      color,
      isActive: true,
      lastActivity: new Date()
    };
    
    // Persist to localStorage
    this.persistCurrentUser();
    
    return this.currentUser;
  }

  /**
   * Ensure the current user is initialized from available sources.
   * Priority: previously saved current-user -> legacy keys -> default,
   * then attempt to update from IMS profile asynchronously if available.
   */
  ensureInitialized() {
    if (this.currentUser && this.currentUser.email) return;
    // 1) Try loading the serialized current user
    if (this.loadCurrentUser && this.loadCurrentUser()) {
      // Optionally refresh from IMS profile in background
      this.initFromIMSIfAvailable?.();
      return;
    }
    // 2) Fallback to legacy localStorage keys used by older code paths
    try {
      const savedEmail = localStorage.getItem('user-email');
      const savedName = localStorage.getItem('user-display-name');
      if (savedEmail) {
        this.setCurrentUser(savedEmail, savedName || this.extractNameFromEmail(savedEmail));
        this.initFromIMSIfAvailable?.();
        return;
      }
    } catch (_) {}
    // 3) Default placeholder user so UI can render immediately
    this.setCurrentUser('user@example.com', 'User');
    // Try to improve with IMS profile if present
    this.initFromIMSIfAvailable?.();
  }

  /**
   * If IMS is available in the environment, try to populate/refresh user
   * information. This runs asynchronously and does not block UI rendering.
   */
  initFromIMSIfAvailable() {
    try {
      const ims = typeof window !== 'undefined' ? window.adobeIMS : null;
      if (!ims || typeof ims.getProfile !== 'function') return;
      ims.getProfile().then((profile) => {
        if (!profile) return;
        const email = profile.email || profile.userId || this.currentUser.email;
        const displayName = profile.displayName || profile.name || this.extractNameFromEmail(email);
        if (email && email !== this.currentUser.email) {
          this.setCurrentUser(email, displayName);
        } else {
          this.updateCurrentUser({ displayName });
        }
      });
    } catch (_) {
      // Ignore failures; UI already has a fallback user
    }
  }

  /**
   * Update current user information
   */
  updateCurrentUser(updates) {
    this.currentUser = {
      ...this.currentUser,
      ...updates,
      lastActivity: new Date()
    };
    this.persistCurrentUser();
  }

  /**
   * Add a user (does not make them current)
   */
  addUser(email, displayName = '') {
    const color = this.generateUserColor(email);
    
    const user = {
      email,
      displayName: displayName || this.extractNameFromEmail(email),
      avatar: '', // No avatar support - using initials instead
      color,
      isActive: false,
      lastActivity: new Date()
    };
    
    this.users.set(email, user);
    
    // Initialize presence
    this.userPresence.set(email, {
      online: false,
      cursor: null,
      selectedElement: null,
      lastSeen: new Date()
    });
    
    return user;
  }

  /**
   * Remove a user
   */
  removeUser(email) {
    this.users.delete(email);
    this.userPresence.delete(email);
  }

  /**
   * Update a user's information
   */
  updateUser(email, updates) {
    const user = this.users.get(email);
    if (user) {
      this.users.set(email, {
        ...user,
        ...updates,
        lastActivity: new Date()
      });
    }
  }

  /**
   * Set user presence information
   */
  setUserPresence(email, presence) {
    const currentPresence = this.userPresence.get(email) || {};
    this.userPresence.set(email, {
      ...currentPresence,
      ...presence,
      lastSeen: new Date()
    });
  }

  /**
   * Update user activity timestamp
   */
  updateUserActivity(email) {
    if (email === this.currentUser.email) {
      this.currentUser.lastActivity = new Date();
    } else {
      const user = this.users.get(email);
      if (user) {
        user.lastActivity = new Date();
        this.users.set(email, user);
      }
    }
    
    // Update presence
    const presence = this.userPresence.get(email);
    if (presence) {
      presence.lastSeen = new Date();
      this.userPresence.set(email, presence);
    }
  }

  /**
   * Clear all users (except current)
   */
  clearUsers() {
    this.users.clear();
    this.userPresence.clear();
  }

  /**
   * Set multiple users at once (for loading from storage/API)
   */
  setUsers(usersList) {
    this.clearUsers();
    for (const user of usersList) {
      if (user.email !== this.currentUser.email) {
        this.addUser(user.email, user.displayName);
        if (user.presence) {
          this.setUserPresence(user.email, user.presence);
        }
      }
    }
  }

  /**
   * Get all users (current + others)
   */
  get allUsers() {
    const allUsers = [this.currentUser];
    for (const user of this.users.values()) {
      allUsers.push(user);
    }
    return allUsers;
  }

  /**
   * Get active users (recently active)
   */
  get activeUsers() {
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
    return this.allUsers.filter(user => 
      user.lastActivity > fiveMinutesAgo
    );
  }

  /**
   * Get current user info
   */
  get currentUserInfo() {
    return this.currentUser;
  }

  /**
   * Get list of all users (excluding current)
   */
  get usersList() {
    return Array.from(this.users.values());
  }

  /**
   * Get users indexed by email
   */
  get usersByEmail() {
    const map = new Map();
    map.set(this.currentUser.email, this.currentUser);
    for (const [email, user] of this.users) {
      map.set(email, user);
    }
    return map;
  }

  /**
   * Get online users
   */
  get onlineUsers() {
    const online = [];
    
    // Current user is always online
    online.push(this.currentUser);
    
    // Check other users
    for (const [email, user] of this.users) {
      const presence = this.userPresence.get(email);
      if (presence?.online) {
        online.push(user);
      }
    }
    
    return online;
  }

  /**
   * Get offline users
   */
  get offlineUsers() {
    const offline = [];
    
    for (const [email, user] of this.users) {
      const presence = this.userPresence.get(email);
      if (!presence?.online) {
        offline.push(user);
      }
    }
    
    return offline;
  }

  /**
   * Get user by email
   */
  getUserByEmail(email) {
    if (!email) return null;
    
    if (email === this.currentUser.email) {
      return this.currentUser;
    }
    
    return this.users.get(email) || null;
  }

  /**
   * Get user avatar URL (always empty now - using initials instead)
   */
  getUserAvatar(email) {
    return ''; // No avatar support - using initials instead
  }

  /**
   * Get user display name or extract from email
   */
  getUserDisplayName(email) {
    const user = this.getUserByEmail(email);
    return user?.displayName || this.extractNameFromEmail(email);
  }

  /**
   * Get user color for indicators
   */
  getUserColor(email) {
    const user = this.getUserByEmail(email);
    return user?.color || this.generateUserColor(email);
  }

  /**
   * Get user initials
   */
  getUserInitials(email) {
    const displayName = this.getUserDisplayName(email);
    
    if (!displayName) return '?';
    
    const parts = displayName.split(' ');
    if (parts.length >= 2) {
      return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    }
    
    // For single names or email, use first two letters
    return displayName.substring(0, 2).toUpperCase();
  }

  /**
   * Check if user is online
   */
  isUserOnline(email) {
    if (email === this.currentUser.email) {
      return true;
    }
    
    const presence = this.userPresence.get(email);
    return presence?.online || false;
  }


  /**
   * Extract name from email
   */
  extractNameFromEmail(email) {
    if (!email) return 'Unknown User';
    
    const [localPart] = email.split('@');
    // Convert dots and underscores to spaces and capitalize
    return localPart
      .replace(/[._-]/g, ' ')
      .replace(/\b\w/g, char => char.toUpperCase());
  }

  /**
   * Generate a consistent color for a user based on their email
   */
  generateUserColor(email) {
    if (!email) return '#808080';
    
    const colors = [
      '#FF6B6B', // Red
      '#4ECDC4', // Teal
      '#45B7D1', // Blue
      '#96CEB4', // Green
      '#FECA57', // Yellow
      '#9B59B6', // Purple
      '#FD79A8', // Pink
      '#A29BFE', // Lavender
      '#6C5CE7', // Violet
      '#00B894', // Mint
      '#FDCB6E', // Orange
      '#E17055', // Coral
      '#74B9FF', // Sky Blue
      '#A3CB38', // Lime
      '#FF7675', // Light Red
      '#2D3436'  // Dark Gray
    ];
    
    // Generate consistent index based on email
    let hash = 0;
    for (let i = 0; i < email.length; i++) {
      hash = email.charCodeAt(i) + ((hash << 5) - hash);
    }
    
    return colors[Math.abs(hash) % colors.length];
  }

  /**
   * Load current user from localStorage
   */
  loadCurrentUser() {
    const stored = localStorage.getItem('current-user');
    if (stored) {
      try {
        const user = JSON.parse(stored);
        this.currentUser = {
          ...user,
          lastActivity: new Date(user.lastActivity || Date.now())
        };
        return true;
      } catch (e) {
        console.error('Failed to load current user:', e);
      }
    }
    return false;
  }

  /**
   * Persist current user to localStorage
   */
  persistCurrentUser() {
    try {
      localStorage.setItem('current-user', JSON.stringify({
        email: this.currentUser.email,
        displayName: this.currentUser.displayName,
        avatar: this.currentUser.avatar,
        color: this.currentUser.color,
        lastActivity: this.currentUser.lastActivity.toISOString()
      }));
    } catch (e) {
      console.error('Failed to persist current user:', e);
    }
  }

  /**
   * Export users for persistence
   */
  exportUsers() {
    return {
      currentUser: {
        ...this.currentUser,
        lastActivity: this.currentUser.lastActivity.toISOString()
      },
      users: Array.from(this.users.entries()).map(([email, user]) => ({
        ...user,
        lastActivity: user.lastActivity.toISOString()
      })),
      presence: Array.from(this.userPresence.entries()).map(([email, presence]) => ({
        email,
        ...presence,
        lastSeen: presence.lastSeen.toISOString()
      }))
    };
  }

  /**
   * Import users from persistence
   */
  importUsers(data) {
    if (!data) return;
    
    // Import current user
    if (data.currentUser) {
      this.setCurrentUser(
        data.currentUser.email,
        data.currentUser.displayName
      );
    }
    
    // Import users
    if (data.users || data.remoteUsers) {
      const usersList = data.users || data.remoteUsers; // Support both old and new format
      for (const user of usersList) {
        this.addUser(user.email, user.displayName);
      }
    }
    
    // Import presence
    if (data.presence) {
      for (const presenceData of data.presence) {
        const { email, ...presence } = presenceData;
        this.setUserPresence(email, {
          ...presence,
          lastSeen: new Date(presence.lastSeen)
        });
      }
    }
  }
}

makeObservable(UserStore);
