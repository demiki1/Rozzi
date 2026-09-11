# ROZZI Admin Dashboard — Design Pass

Implemented a ROZZI-branded admin command center across `apps/admin`.

## Visual direction
- Modern fintech + logistics + marketplace
- Fixed dark sidebar with grouped navigation
- ROZZI logo and subtle motion
- Light data-dense workspace
- Orange/gold brand accents with restrained status colors
- Sticky global top bar and global search
- Responsive sidebar and mobile layout
- Shared cards, status badges, buttons, tables, loading states

## Dashboard home
- Command Center greeting
- Orders, GMV, active vendors, online riders KPIs
- Marketplace performance chart
- Needs Attention queue
- Live order activity
- Operations pulse
- Quick actions
- Refreshes operational data every 30 seconds

## Existing admin modules
The redesign preserves the existing routes/API integrations for:
Overview, Orders, Deliveries/Live Operations, Vendors, Riders, Locations, Categories/Catalog, Finance, Promotions, Content, Banners & Ads, Support, Notifications, Audit Logs and Settings.

No fake API data was added. Dashboard metrics are derived from the existing admin API responses where available.

## Verification note
A local production build could not be completed in this environment because dependency installation timed out. The source changes are packaged for the project's normal Windows runtime verification.
