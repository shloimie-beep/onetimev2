# OT-51P Identity And Capability Matrix

## Identity Rules

| Case | Result |
| --- | --- |
| Private one-to-one chat with active server-created mapping | Eligible for capability check. |
| Group, supergroup, channel, anonymous admin, forwarded message, or edited message | Denied before any application action. |
| Missing provider identity or chat ref | Denied. |
| Unmapped or revoked mapping | Denied. |
| Disabled/suspended user or inactive/suspended membership | Denied. |
| Account/product/membership mismatch | Denied. |
| Role outside `owner` or `admin` | Denied. |
| Security version mismatch | Denied, including between preview and confirmation. |
| Capability not advertised by the injected adapter or actor | Denied truthfully. |

## Initial Capabilities

| Capability | Command | Adapter method | Write? | Confirmation |
| --- | --- | --- | --- | --- |
| `product_status` | `status` | `getProductStatus` | No | No |
| `upcoming_classes` | `classes` | `listUpcomingClasses` | No | No |
| `content_pipeline_status` | `content` | `getContentPipelineStatus` | No | No |
| `contact_lookup` | `contacts <query>` | `searchContacts` | No | No |
| `task_lookup` | `tasks [query]` | `lookupTasks` | No | No |
| `task_create` | `task create <title>` | `previewTaskCreate`, `createTask` | Yes | Required |
| `task_update` | `task update <task> <version> <open|done|blocked>` | `previewTaskUpdate`, `updateTask` | Yes | Required |

## Role Matrix

| Role | Default |
| --- | --- |
| `owner` | Allowed only for advertised capabilities. |
| `admin` | Allowed only for advertised capabilities. |
| `crm_agent` | Denied by default for OT-51P internal ops bot. |
| `viewer` | Denied by default. |
| parent/student/public/anonymous | Not represented as bot actors; denied. |

## No Self-Linking

Mapping activation and revocation exist only through protected repository/service
operations. No public command, webhook input, username, display name, shared
phone, group membership, forwarded content, or message possession can create a
mapping.
