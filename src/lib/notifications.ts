/**
 * Email Notification Configuration
 * 
 * This file sets up email notifications for key events:
 * - New user signup (admin notification)
 * - User approved (user notification)
 * - Relationship request received
 * - Event invitation
 */

// import { supabase } from './supabase'; // REMOVED

export interface EmailNotification {
  to: string;
  subject: string;
  body: string;
  type: 'admin_new_user' | 'user_approved' | 'relationship_request' | 'event_invitation';
}

/**
 * Send email notification via Supabase Edge Function
 * Note: Requires Supabase Edge Function deployment
 */
export async function sendEmailNotification(notification: EmailNotification) {
  try {
    // For now, we'll use Supabase's built-in auth emails
    // To send custom emails, you would deploy a Supabase Edge Function

    console.log('📧 Email notification would be sent:', notification);

    // TODO: Deploy Edge Function for custom emails
    // const { data, error } = await supabase.functions.invoke('send-email', {
    //   body: notification
    // });

    return { success: true };
  } catch (error) {
    console.error('Email notification error:', error);
    return { success: false, error };
  }
}

/**
 * Notify admin of new user signup
 */
export async function notifyAdminNewUser(userEmail: string, userName: string) {
  await sendEmailNotification({
    to: 'fabiank5@hotmail.com',
    subject: '🆕 FreeCal: New User Signup',
    body: `
      New user signed up and needs approval:
      
      Name: ${userName}
      Email: ${userEmail}
      
      Go to FreeCal Admin Dashboard to approve or reject.
      https://51aef9-untitled-project.altanlabs.com/admin
    `,
    type: 'admin_new_user',
  });
}

/**
 * Notify user they've been approved
 */
export async function notifyUserApproved(userEmail: string, userName: string) {
  await sendEmailNotification({
    to: userEmail,
    subject: '✅ Welcome to FreeCal!',
    body: `
      Hi ${userName},
      
      Your FreeCal account has been approved! 🎉
      
      You can now:
      - Create and manage events
      - Import events from screenshots (OCR)
      - Connect with family & friends
      - Find free time together
      
      Get started: https://51aef9-untitled-project.altanlabs.com
      
      Need help? Reply to this email.
    `,
    type: 'user_approved',
  });
}

/**
 * Notify user of new relationship request
 */
export async function notifyRelationshipRequest(
  toEmail: string,
  toName: string,
  fromName: string
) {
  await sendEmailNotification({
    to: toEmail,
    subject: `👥 ${fromName} wants to connect on FreeCal`,
    body: `
      Hi ${toName},
      
      ${fromName} sent you a relationship request on FreeCal!
      
      Accept this request to:
      - See each other's calendars
      - Find free time together
      - Coordinate events
      
      View and respond: https://51aef9-untitled-project.altanlabs.com/profile
    `,
    type: 'relationship_request',
  });
}

/**
 * SIMPLE EMAIL SETUP - Using Browser Notifications
 * For now, we'll use browser notifications instead of emails
 * This works immediately without server setup
 */

export async function requestNotificationPermission() {
  if ('Notification' in window && Notification.permission === 'default') {
    const permission = await Notification.requestPermission();
    return permission === 'granted';
  }
  return Notification.permission === 'granted';
}

export function showBrowserNotification(title: string, body: string) {
  if ('Notification' in window && Notification.permission === 'granted') {
    new Notification(title, {
      body,
      icon: '/favicon/android/android-launchericon-192-192.png',
      badge: '/favicon/android/android-launchericon-96-96.png',
    });
  }
}
