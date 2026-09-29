import { postAuditEvent, type AuditEventItem } from './api';

type AuditListener = (event: AuditEventItem) => void;

class AuditLoggerService {
  private listeners: Set<AuditListener> = new Set();
  private currentUser: string = 'system';
  private lastLoggedAction: string = '';
  private lastLoggedTime: number = 0;

  public setCurrentUser(username: string | null) {
    this.currentUser = username || 'system';
  }

  public getCurrentUser(): string {
    return this.currentUser;
  }

  public subscribe(listener: AuditListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  /**
   * Log an audit event to the backend and notify local subscribers.
   */
  public async log(
    action: string,
    description: string,
    details: Record<string, any> = {},
    entityType?: string,
    entityId?: string
  ): Promise<AuditEventItem | null> {
    const now = Date.now();
    // Debounce exact duplicates within 600ms
    if (this.lastLoggedAction === `${action}:${description}` && now - this.lastLoggedTime < 600) {
      return null;
    }
    this.lastLoggedAction = `${action}:${description}`;
    this.lastLoggedTime = now;

    const payloadDetails = {
      ...details,
      description,
      username: this.currentUser,
      actor: this.currentUser,
      logged_at: new Date().toISOString(),
    };

    // Optimistically create an event for immediate UI update
    const optimisticEvent: AuditEventItem = {
      id: Date.now(),
      actor_user_id: null,
      actor_username: this.currentUser,
      action,
      entity_type: entityType || null,
      entity_id: entityId || null,
      details: payloadDetails,
      ip_address: 'client',
      created_at: new Date().toISOString(),
    };

    // Notify listeners immediately
    this.listeners.forEach((listener) => {
      try {
        listener(optimisticEvent);
      } catch (err) {
        console.error('Error in audit listener:', err);
      }
    });

    // Send to backend
    try {
      const persisted = await postAuditEvent(action, payloadDetails, entityType, entityId);
      return persisted;
    } catch (error) {
      console.warn('Could not persist audit event to backend:', error);
      return optimisticEvent;
    }
  }

  // Named logging methods:
  public logNavigation(toView: string, detailDesc?: string) {
    if (toView === 'inspection' || toView.toLowerCase() === 'home') {
      this.log('home.view', detailDesc || 'Opened Home (Inspection) view', {
        event_name: 'Home',
        view: 'inspection',
      }, 'navigation', 'home');
    } else if (toView === 'analytics') {
      this.log('analytics.view', detailDesc || 'Opened Analytics & Dashboard', {
        event_name: 'Analytics',
        view: 'analytics',
      }, 'navigation', 'analytics');
    } else if (toView === 'connections') {
      this.log('connections.view', detailDesc || 'Opened Hardware Connections view', {
        event_name: 'Connections',
        view: 'connections',
      }, 'navigation', 'connections');
    } else if (toView === 'settings') {
      this.log('settings.view', detailDesc || 'Opened Settings view', {
        event_name: 'Settings',
        view: 'settings',
      }, 'navigation', 'settings');
    }
  }

  public logSettingsTab(tabName: string) {
    this.log(`settings.${tabName.toLowerCase().replace(/\s+/g, '_')}`, `Opened ${tabName} tab in Settings`, {
      event_name: tabName === 'UI' ? 'UI Settings' : tabName,
      tab: tabName,
    }, 'settings', tabName);
  }

  public logAction(eventName: string, actionKey: string, description: string, extra?: Record<string, any>) {
    this.log(actionKey, description, {
      event_name: eventName,
      ...(extra || {}),
    });
  }
}

export const auditLogger = new AuditLoggerService();
