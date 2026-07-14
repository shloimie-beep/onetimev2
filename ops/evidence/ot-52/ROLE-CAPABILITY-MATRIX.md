# OT-52P Role Capability Matrix

## Parent

- Can read authorized household dashboard with `parent:household:read`.
- Can create/update/archive/restore learners only for authorized households.
- Can manage student access lifecycle only through the injected credential adapter seam.
- Can launch classes only through protected action descriptors.
- Can preview support copy; no external send is performed.
- Can read rewards; reward writes require explicit `rewards:write`.

## Student

- Can read only the learner bound to `actor.student_learner`.
- Can launch only that learner's class through a protected action descriptor.
- Can read own library, progress, rewards, and updates.
- Cannot select siblings, households, billing, admin, CRM, or parent controls.
- Cannot write rewards.

## Owner/Admin/Support

- Owner/admin sessions are not silently treated as parent portal users.
- Support-only household relationships are excluded from parent household authority.
- No impersonation or global portal override was added.

## Default Helpers

- Parent/student helper query is unavailable unless a scoped helper adapter is injected.
- The default helper does not synthesize answers.
