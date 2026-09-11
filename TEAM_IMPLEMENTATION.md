# ROZZI Vendor Team Management

## Implemented
- Owner view with store owner identity and full-access label.
- Staff roles: Manager, Cashier, Kitchen, Inventory Manager.
- Add existing ROZZI vendor accounts directly to a team.
- Invite new people by email with a 7-day, hashed invitation token.
- Invitation acceptance with password creation.
- Enable/disable team members.
- Change staff roles.
- Remove staff from the vendor team.
- Audit logging for add, invite, update and removal.
- Responsive Vendor Team UI and invitation acceptance page.

## API
- GET `/api/vendor/team`
- POST `/api/vendor/team/invite`
- PATCH `/api/vendor/team/:memberId`
- DELETE `/api/vendor/team/:memberId`
- POST `/api/vendor/team/invitations/accept?token=...`

## Security notes
- Only the vendor owner can invite, change or remove staff.
- OWNER is not assignable through staff APIs.
- Invitation tokens are stored as SHA-256 hashes and expire after seven days.
- Existing non-vendor accounts cannot be attached to a vendor team.
- No staff member's password is exposed through Team APIs.

## Access-control integration
Team membership and role storage are implemented. Existing vendor modules currently identify the vendor primarily through `ownerUserId`, so staff login authorization across every existing Vendor module still needs a shared vendor-context/access guard rollout before staff can safely operate every module as their assigned role. This is intentionally not claimed as complete in this step.
