# Product Requirements Document (PRD)
# SocialBharat — India-First Social Media Management Platform

## 1. Product Vision
SocialBharat is an AI-powered, India-first social media management platform designed for Indian SMBs, agencies, D2C brands, regional influencers, and enterprise marketing teams. It takes the best architectural patterns from Sprout Social and Hootsuite, and enhances them with India-specific capabilities.

## 2. Target Users
- **Indian SMBs** (restaurants, retail, local services)
- **D2C Brands** (fashion, beauty, FMCG)
- **Digital Marketing Agencies** (managing multiple Indian brand accounts)
- **Regional Influencers & Content Creators**
- **Enterprise Marketing Teams** (BFSI, telecom, FMCG conglomerates)

## 3. Core Features

### 3.1 Publishing & Scheduling
- Post creation: text, image, video, carousel, stories, reels
- Multi-platform publishing (FB, IG, Twitter, LinkedIn, YouTube, WhatsApp, ShareChat)
- Content calendar with drag-and-drop scheduling
- Queue/auto-schedule with IST-optimized posting times
- Bulk scheduling and recurring posts
- Approval workflows (draft → review → approve → publish)
- **Indian Festival Calendar** with 50+ festivals, pre-loaded content templates
- **Cricket match event scheduler** (IPL, World Cup)
- **Regional language content templates**

### 3.2 Engagement Hub (Unified Inbox)
- Unified inbox aggregating messages/comments/mentions from all platforms
- Conversation threading and history
- Assignment to team members
- Tagging, labeling, and CRM-lite contact profiles
- Auto-responses and canned responses
- **WhatsApp Business Inbox** (most critical channel in India)
- **Hinglish smart reply suggestions**
- **Real-time auto-translation in inbox**

### 3.3 Analytics & Reporting
- Profile performance metrics (followers, engagement rate, reach, impressions)
- Post-level analytics
- Audience demographics (age, gender, location, language)
- Competitor analysis
- Custom report builder with scheduled email delivery (PDF/CSV/XLSX)
- **India industry benchmarks** (e-commerce, BFSI, FMCG, education)
- **Regional audience segmentation** (state-wise, language-wise)
- **WhatsApp analytics**
- **Festival campaign ROI tracking**

### 3.4 Social Listening
- Keyword and hashtag monitoring
- Brand mention tracking
- Sentiment analysis
- Trend detection and topic clustering
- Influencer identification
- Crisis alerts
- **Multilingual sentiment** (Hindi, Tamil, Telugu, Bengali, Marathi)
- **Hinglish detection**
- **Regional news & blog monitoring**

### 3.5 AI Studio
- AI content generation (captions, hashtags)
- Content translation (22 Indian languages via IndicTrans2)
- Image alt-text generation
- Smart scheduling (optimal time prediction based on audience data)
- Smart reply suggestions
- Content performance prediction
- **Hinglish content generation**
- **Festival-themed content with AI**
- **Cricket commentary-style social posts**

### 3.6 Media Library
- Asset management (images, videos, GIFs)
- Image/video editing (resize, crop, filters)
- Brand asset organization with folders and tags
- AI-generated alt text
- **Pre-built Indian festival templates** (Diwali, Holi, Independence Day, etc.)
- **Regional language text overlay**
- **WhatsApp-optimized media formats**

### 3.7 Billing & Subscription
- Tiered plans: Free, Starter (₹499/mo), Pro (₹1,499/mo), Business (₹4,999/mo), Enterprise (custom)
- Razorpay integration (UPI, net banking, wallets, EMI)
- Stripe for international payments
- GST-compliant invoicing (CGST, SGST, IGST breakdown)
- Trial management and promo codes
- Annual discount (20% off — common Indian buying pattern)
- Usage metering per plan limits

### 3.8 Team & Collaboration
- Team member management with role-based access (Owner, Admin, Editor, Viewer)
- Approval workflows with multi-step chains
- Task assignments
- Activity/audit logs
- **Multi-language approval workflows**

### 3.9 Integrations
- Zoho CRM, Freshworks, HubSpot
- Shopify, WooCommerce
- Google Analytics
- Slack, Microsoft Teams
- Zapier-like automation triggers
- Webhook management

## 4. Pricing Strategy (INR)

| Plan       | Price/mo | Social Profiles | Users | Key Features                                          |
|------------|----------|-----------------|-------|-------------------------------------------------------|
| Free       | ₹0       | 3               | 1     | Basic scheduling, limited analytics                   |
| Starter    | ₹499     | 5               | 2     | Full scheduling, basic analytics, WhatsApp            |
| Pro        | ₹1,499   | 15              | 5     | AI content, listening, advanced analytics             |
| Business   | ₹4,999   | 30              | 10    | All features, approval workflows, custom reports      |
| Enterprise | Custom   | Unlimited       | Unlimited | SSO, API access, dedicated support, SLA           |

## 5. Non-Functional Requirements
- **Performance**: Pages load < 2s, API responses < 500ms
- **Scalability**: Support 100K+ concurrent users
- **Availability**: 99.9% uptime SLA
- **Security**: DPDP Act compliance, data encrypted at rest and in transit
- **Data Residency**: All data in India (ap-south-1 Mumbai)
- **Accessibility**: WCAG 2.1 AA compliance
- **Mobile**: Fully responsive web app, native mobile app in Phase 4

## 6. Success Metrics (PMF Signals)
- signed_up → completed_core_action (>20% within 7 days)
- completed_core_action → started_checkout (>5%)
- started_checkout → converted_to_paid (>30%)
- ≥3 organic referrals in first week = strong pull signal
- converted_to_paid ≥5% of signed_up within 14 days = PMF signal
