# Requirements Specification
# SocialBharat — User Stories with Acceptance Criteria

## Epic 1: Authentication & Onboarding

### US-1.1: Phone OTP Registration (India-First)
**As a** new Indian user  
**I want to** register using my phone number with OTP  
**So that** I can get started quickly without remembering passwords  

**Acceptance Criteria:**
- Given I am on the registration page, When I enter a valid Indian phone number (+91), Then I receive a 6-digit OTP via SMS within 30 seconds
- Given I have received an OTP, When I enter the correct OTP within 5 minutes, Then my account is created and I am redirected to the onboarding wizard
- Given I enter an incorrect OTP 3 times, Then my OTP is invalidated and I must request a new one
- Given the OTP expires after 5 minutes, When I try to verify, Then I see an error and can request a new OTP
- Given I am a new user, When I complete OTP verification, Then I am prompted to set up my organization name and preferred language

### US-1.2: Email/Password Registration
**As a** user who prefers email  
**I want to** register with email and password  
**So that** I have a traditional login option  

**Acceptance Criteria:**
- Given I am on the registration page, When I enter a valid email and password (min 8 chars, 1 upper, 1 number), Then my account is created after email verification
- Given I submit a duplicate email, Then I see an error "An account with this email already exists"
- Given I register successfully, When I check my email, Then I receive a verification email within 60 seconds

### US-1.3: OAuth Social Login
**As a** user  
**I want to** log in with Google  
**So that** I can sign in with one click  

**Acceptance Criteria:**
- Given I click "Continue with Google", When I authorize the app, Then I am logged in and redirected to the dashboard
- Given the OAuth state parameter is missing or invalid, Then the login fails with a security error

### US-1.4: Organization Setup
**As a** newly registered user  
**I want to** create my organization  
**So that** I can manage my social media accounts  

**Acceptance Criteria:**
- Given I complete registration, When I reach the onboarding wizard, Then I am prompted for: organization name, industry, team size, preferred language
- Given I complete org setup, When I click finish, Then my organization is created with me as Owner and I see the empty dashboard

### US-1.5: Team Invitation
**As an** org Owner/Admin  
**I want to** invite team members  
**So that** my team can collaborate  

**Acceptance Criteria:**
- Given I am on the Team Settings page, When I enter an email/phone and select a role (Admin/Editor/Viewer), Then an invitation is sent
- Given I am an Editor, When I try to invite members, Then I see "Only Owners and Admins can invite members"
- Given someone accepts my invitation, Then they appear in the team list with the assigned role

---

## Epic 2: Social Account Connection

### US-2.1: Connect Social Profiles
**As a** user  
**I want to** connect my social media accounts via OAuth  
**So that** I can manage them from SocialBharat  

**Acceptance Criteria:**
- Given I am on Settings > Social Accounts, When I click "Connect Facebook Page", Then I am redirected to Facebook OAuth and can select pages to connect
- Given OAuth is successful, When I return to SocialBharat, Then the connected profile appears with its avatar, name, and follower count
- Given the token expires, When I next access the profile, Then I see a "Reconnect" prompt
- Platforms: Facebook Pages, Instagram Business, Twitter/X, LinkedIn Pages, YouTube, Google Business

### US-2.2: Connect WhatsApp Business (India Priority)
**As an** Indian business user  
**I want to** connect my WhatsApp Business account  
**So that** I can manage WhatsApp from the unified inbox  

**Acceptance Criteria:**
- Given I have a WhatsApp Business API account, When I enter my Phone Number ID and access token, Then WhatsApp is connected
- Given WhatsApp is connected, When a customer sends a message, Then it appears in the unified inbox within 5 seconds
- Given I reply from the inbox, Then the reply is sent via WhatsApp to the customer

---

## Epic 3: Publishing & Scheduling

### US-3.1: Create and Publish a Post
**As a** user  
**I want to** compose a post and publish it to multiple platforms  
**So that** I can manage all my social presence in one place  

**Acceptance Criteria:**
- Given I am on the Compose page, When I write text and select target profiles, Then I see a real-time preview per platform
- Given I click "Publish Now", When the post is published, Then I see confirmation with links to each platform's live post
- Given a publish fails on one platform, Then I see the error for that platform while others succeed
- Given different platforms have different character limits, Then the composer shows remaining characters per platform

### US-3.2: Schedule a Post
**As a** user  
**I want to** schedule a post for a future time  
**So that** I can plan my content calendar  

**Acceptance Criteria:**
- Given I have composed a post, When I select a date/time and click "Schedule", Then the post appears on the content calendar at the scheduled time
- Given the scheduled time arrives, When the system processes the queue, Then the post is published automatically
- Given I schedule in IST, When a user in a different timezone views the calendar, Then they see the time converted to their local timezone

### US-3.3: Content Calendar
**As a** user  
**I want to** view all scheduled posts on a calendar  
**So that** I can visualize my content plan  

**Acceptance Criteria:**
- Given I am on the Calendar page, When I view by week/month, Then I see all scheduled, published, and draft posts
- Given I drag a scheduled post to a new date, Then the schedule is updated
- Given I click a post on the calendar, Then I see its details and can edit it

### US-3.4: Indian Festival Suggestions
**As an** Indian marketer  
**I want to** see upcoming festival content suggestions  
**So that** I never miss a cultural moment  

**Acceptance Criteria:**
- Given an Indian festival is within 14 days, When I open the composer, Then I see a suggestion banner with the festival name, hashtags, and content ideas
- Given I click "Use Template", Then a festival-themed post draft is populated with AI-generated content
- Given my org is in Tamil Nadu, Then I see Pongal suggestions prominently (regional filtering)

### US-3.5: Approval Workflows
**As an** agency editor  
**I want to** submit posts for client approval before publishing  
**So that** brand safety is maintained  

**Acceptance Criteria:**
- Given approval workflow is enabled, When an Editor creates a post, Then it goes to "Pending Approval" status
- Given I am an Admin/Owner, When I see a pending post, Then I can Approve (moves to scheduled) or Reject (returns to draft with feedback)
- Given a post is rejected, Then the author receives a notification with the rejection reason

---

## Epic 4: Engagement Hub (Unified Inbox)

### US-4.1: Unified Inbox
**As a** user  
**I want to** see all messages, comments, and mentions in one inbox  
**So that** I don't miss any engagement  

**Acceptance Criteria:**
- Given I am on the Inbox page, When new messages arrive, Then they appear in real-time without page refresh
- Given I have multiple social profiles, When I filter by platform, Then I see only messages from that platform
- Given a message arrives, Then I see: sender name, avatar, platform icon, timestamp, message preview

### US-4.2: Reply to Messages
**As a** user  
**I want to** reply directly from the unified inbox  
**So that** I can respond quickly  

**Acceptance Criteria:**
- Given I am viewing a conversation, When I type a reply and click Send, Then the reply is posted on the original platform
- Given the AI Smart Reply is enabled, When I open a message, Then I see 2-3 suggested replies
- Given the message is in Hindi, Then smart replies are generated in Hindi

### US-4.3: Assign Conversations
**As a** team lead  
**I want to** assign conversations to team members  
**So that** workload is distributed  

**Acceptance Criteria:**
- Given I am viewing a conversation, When I click Assign and select a team member, Then the conversation moves to their assigned inbox
- Given a conversation is assigned to me, Then I see a notification and the conversation is highlighted

---

## Epic 5: Analytics & Reporting

### US-5.1: Analytics Dashboard
**As a** user  
**I want to** see my social media performance at a glance  
**So that** I can track my growth  

**Acceptance Criteria:**
- Given I am on the Analytics page, When I select a date range, Then I see: followers growth, total impressions, engagement rate, top posts
- Given I have multiple profiles, When I switch between them, Then metrics update for the selected profile
- Given I select "All Profiles", Then I see aggregated cross-platform metrics

### US-5.2: Custom Reports
**As a** Pro/Business user  
**I want to** create custom reports and schedule them  
**So that** I can share performance updates with clients/stakeholders  

**Acceptance Criteria:**
- Given I am on Reports, When I select metrics and date range, Then a report is generated
- Given I schedule a weekly report, When the scheduled time arrives, Then the report is emailed as PDF
- Given I export, Then I can download as PDF, CSV, or XLSX

---

## Epic 6: AI Studio

### US-6.1: AI Content Generation
**As a** user  
**I want to** generate social media content using AI  
**So that** I can create posts faster  

**Acceptance Criteria:**
- Given I am in the composer or AI Studio, When I enter a prompt and select platform + language + tone, Then AI generates optimized content
- Given I select "Hinglish" tone, Then content is generated in a natural Hindi-English mix
- Given I select a festival context (e.g., "Diwali"), Then content includes relevant cultural references
- Given content is generated, Then I also see auto-generated hashtags and translated versions

### US-6.2: Smart Scheduling
**As a** user  
**I want the** AI to suggest the best posting times  
**So that** I maximize engagement  

**Acceptance Criteria:**
- Given I have published at least 10 posts, When I click "Suggest Best Time", Then AI recommends times based on my audience's engagement patterns
- Given my audience is primarily in India, Then suggestions are optimized for IST peak times

---

## Epic 7: Billing & Payments

### US-7.1: Subscribe to a Plan
**As a** user  
**I want to** upgrade to a paid plan  
**So that** I can access premium features  

**Acceptance Criteria:**
- Given I am on the Pricing page, When I select a plan and click Subscribe, Then I am redirected to Razorpay checkout
- Given I pay via UPI, When the payment succeeds, Then my plan is upgraded immediately
- Given I am from Karnataka, Then my invoice shows CGST (9%) + SGST (9%)
- Given I am from Maharashtra, Then my invoice shows IGST (18%)
- Given I provide my GSTIN, Then it appears on the invoice

### US-7.2: Manage Subscription
**As a** subscriber  
**I want to** manage my subscription  
**So that** I can upgrade, downgrade, or cancel  

**Acceptance Criteria:**
- Given I am on Billing Settings, When I view my subscription, Then I see: current plan, next billing date, payment method, invoice history
- Given I click "Cancel", Then I see a confirmation dialog warning of feature loss, and cancellation takes effect at end of billing period

---

## Epic 8: Notifications

### US-8.1: Multi-Channel Notifications
**As a** user  
**I want to** receive notifications about important events  
**So that** I stay informed  

**Acceptance Criteria:**
- Given a new message arrives in the inbox, Then I receive an in-app notification
- Given I have enabled WhatsApp alerts, Then critical alerts are sent via WhatsApp
- Given I have enabled email digests, Then I receive a daily summary email
- Given I am in notification preferences, When I toggle channels, Then only selected channels fire
