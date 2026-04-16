import {
  BasePlatformConnector,
  PlatformProfile,
  PlatformMetrics,
  ReplyContext,
  PlatformReplyResult,
} from "./base";

/**
 * WhatsApp Cloud API connector
 * Supports sending messages, templates, broadcasts, and parsing webhooks
 */
export class WhatsAppConnector extends BasePlatformConnector {
  private phoneNumberId: string;

  constructor(accessToken: string, phoneNumberId: string) {
    super(accessToken);
    this.phoneNumberId = phoneNumberId;
  }

  /**
   * Send a text message to a phone number
   * @param to - Phone number with country code (e.g., +919876543210)
   * @param message - Text message content
   * @returns Message ID
   */
  async sendMessage(to: string, message: string): Promise<string> {
    try {
      const url = `https://graph.facebook.com/v19.0/${this.phoneNumberId}/messages`;

      const body = {
        messaging_product: "whatsapp",
        to: to,
        type: "text",
        text: {
          body: message,
        },
      };

      const response = await fetch(url, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      });

      const data = await response.json();

      if (data.error) {
        throw new Error(data.error.message);
      }

      return data.messages[0].id;
    } catch (error) {
      throw new Error(
        error instanceof Error ? error.message : "Failed to send message",
      );
    }
  }

  /**
   * Send a template message
   * @param to - Phone number with country code
   * @param templateName - Template name from WhatsApp Business Manager
   * @param language - Language code (e.g., en, hi)
   * @param components - Template components (optional)
   * @returns Message ID
   */
  async sendTemplate(
    to: string,
    templateName: string,
    language: string,
    components?: unknown[],
  ): Promise<string> {
    try {
      const url = `https://graph.facebook.com/v19.0/${this.phoneNumberId}/messages`;

      const body: Record<string, unknown> = {
        messaging_product: "whatsapp",
        to: to,
        type: "template",
        template: {
          name: templateName,
          language: {
            code: language,
          },
        },
      };

      if (components) {
        (body.template as Record<string, unknown>).components = components;
      }

      const response = await fetch(url, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      });

      const data = await response.json();

      if (data.error) {
        throw new Error(data.error.message);
      }

      return data.messages[0].id;
    } catch (error) {
      throw new Error(
        error instanceof Error ? error.message : "Failed to send template",
      );
    }
  }

  /**
   * Send a broadcast message to multiple recipients
   * @param recipients - Array of phone numbers
   * @param templateName - Template name
   * @param language - Language code
   * @returns Broadcast ID
   */
  async sendBroadcast(
    recipients: string[],
    templateName: string,
    language: string,
  ): Promise<string> {
    try {
      const url = `https://graph.facebook.com/v19.0/${this.phoneNumberId}/message_broadcasts`;

      const body = {
        messaging_product: "whatsapp",
        to: recipients,
        template: {
          name: templateName,
          language: {
            code: language,
          },
        },
      };

      const response = await fetch(url, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      });

      const data = await response.json();

      if (data.error) {
        throw new Error(data.error.message);
      }

      return data.id;
    } catch (error) {
      throw new Error(
        error instanceof Error ? error.message : "Failed to send broadcast",
      );
    }
  }

  /**
   * Parse incoming webhook payload
   * @param payload - Raw webhook payload from WhatsApp
   * @returns Parsed message data
   */
  handleWebhook(payload: unknown): {
    from: string;
    message: string;
    timestamp: number;
  } {
    const data = payload as Record<string, unknown>;
    const entry = data.entry as Array<Record<string, unknown>>;
    const changes = entry?.[0]?.changes as Array<Record<string, unknown>>;
    const value = changes?.[0]?.value as Record<string, unknown>;
    const messages = value?.messages as Array<Record<string, unknown>>;
    const message = messages?.[0] as Record<string, unknown>;

    const from = message.from as string;
    const text = (message.text as Record<string, unknown>)?.body as string;
    const timestamp = parseInt(message.timestamp as string, 10);

    return { from, message: text, timestamp };
  }

  // WhatsApp doesn't support post publishing like other platforms
  async publishPost(): Promise<never> {
    throw new Error(
      "WhatsApp does not support post publishing. Use sendMessage, sendTemplate, or sendBroadcast.",
    );
  }

  async deletePost(): Promise<never> {
    throw new Error("WhatsApp does not support post deletion.");
  }

  async getProfile(): Promise<PlatformProfile> {
    try {
      const url = `https://graph.facebook.com/v19.0/${this.phoneNumberId}`;
      const response = await fetch(
        `${url}?fields=name,verified_profile_picture_url`,
        {
          headers: {
            Authorization: `Bearer ${this.accessToken}`,
          },
        },
      );

      const data = await response.json();

      return {
        id: data.id,
        name: data.name,
        avatarUrl: data.verified_profile_picture_url,
        platformUserId: data.id,
      };
    } catch (error) {
      throw new Error(
        error instanceof Error ? error.message : "Failed to fetch profile",
      );
    }
  }

  async getMetrics(): Promise<PlatformMetrics> {
    // WhatsApp Business metrics are limited
    return {
      followers: 0,
      engagement: 0,
      reach: 0,
      impressions: 0,
    };
  }

  async checkTokenHealth(): Promise<boolean> {
    try {
      const url = `https://graph.facebook.com/v19.0/${this.phoneNumberId}`;
      const response = await fetch(url, {
        headers: {
          Authorization: `Bearer ${this.accessToken}`,
        },
      });

      return !response.ok ? false : true;
    } catch {
      return false;
    }
  }

  async refreshToken(): Promise<string> {
    return this.accessToken;
  }

  async sendReply(
    context: ReplyContext,
    text: string,
  ): Promise<PlatformReplyResult> {
    try {
      if (!context.recipientPlatformId) {
        throw new Error(
          "recipientPlatformId (phone number) required for WhatsApp reply",
        );
      }
      const messageId = await this.sendMessage(
        context.recipientPlatformId,
        text,
      );
      return { platformMessageId: messageId, status: "sent" };
    } catch (error) {
      return {
        platformMessageId: "",
        status: "failed",
        error:
          error instanceof Error
            ? error.message
            : "Failed to send WhatsApp reply",
      };
    }
  }
}
