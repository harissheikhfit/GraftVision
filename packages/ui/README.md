# GraftVision UI Foundation

## Application shell catalogue

UI-FOUNDATION-005 adds structural, data-free shells under `src/shells`:

| Shell               | Trust level and intended structure                                                                 |
| ------------------- | -------------------------------------------------------------------------------------------------- |
| `PublicShell`       | GraftVision-only identity, public content width, and footer readiness; no private context or nav   |
| `ClinicShell`       | Private workspace header, desktop sidebar, mobile-nav slot, active context, privacy, and status    |
| `PlatformShell`     | Separate platform-operations identity, restricted context, and no default patient-context region   |
| `ScanShell`         | Mobile-first single-task frame with session, connectivity, progress, work, and bottom-action slots |
| `PresentationShell` | Fixed patient-safe stage, large-screen header/footer, and lock readiness without private controls  |

`AppShell` supplies the common frame and lock boundary. Header, sidebar, navigation, toolbar,
footer, context, responsive-region, overlay, and presentation-stage components are separately
composable and explicitly exported. These are layout contracts, not finished screens.

## Trust and privacy separation

Clinic, platform, scan, presentation, and public shells intentionally have different structures.
The presentation surface does not expose private navigation, active-user controls, downloads,
patient search, or internal status. Platform structure has no default patient context. Public
structure has no clinic branding or private workspace assumptions. Privacy and session bars use
the protected shared state tokens and visible text; clinic accents cannot replace their meaning.

Shared-device foundations show a generic active-user or shared-device label without identity by
default. `ShellLockLayer` covers the viewport and reuses `ScreenLockState`; when `AppShell` is
locked, its normal frame is both `inert` and hidden from assistive technology. Timers, revocation,
unlock authentication, and persistence remain outside this foundation.

## Responsive and presentation patterns

Responsive behavior is CSS-driven. Mobile uses a compact header, single-column content, optional
bottom navigation, minimum touch targets, dynamic viewport units, and safe-area padding. Desktop
private shells give the sidebar and main content independent scroll ownership. Tablet classes
support future overlay navigation without implementing a menu. Logical properties keep the layout
ready for RTL content, while shared breakpoint and layer values govern responsive and stacking
behavior.

Presentation uses a fixed full-screen frame, 16:9-aware stage width, overscan-conscious padding,
large typography, patient-safe indication, and a neutral protected lock surface. It does not rely
on hover. Scan uses one independently scrolling work region between a compact header and safe-area
bottom action region, with no sidebar or clinic-wide navigation.

## Server and product boundaries

Every component in `src/shells` remains Server Component compatible: there are no client
directives, hooks, browser APIs, breakpoint listeners, timers, or stores. Consumer-provided
actions may be owned by an application Client Component when later work requires interaction.

Authentication, permissions, permission filtering, working menus, breadcrumbs, notifications,
accounts, product navigation, patient data, clinical workflows, scan controls, camera access,
presentation sessions, and persistence are deliberately not implemented.

## Scope and decision

UI-FOUNDATION-002 provides restrained interaction primitives, not product forms or screens. Native
HTML elements supply the semantics and browser interaction wherever possible. No headless
component library is required for this scope: Radix UI, React Aria, Headless UI, Tailwind, form
libraries, and broad UI frameworks would add coupling without improving these native controls.

The package keeps one explicit public entry and one shared CSS entry. Components accept native
attributes and React 19 `ref` props where focus management, form integration, or future workflow
composition may need them. There is no polymorphic `as` API.

## Public primitives

| Primitive          | Native basis                            | Main additions                                                                                | Out of scope                               |
| ------------------ | --------------------------------------- | --------------------------------------------------------------------------------------------- | ------------------------------------------ |
| `Button`           | `<button>`                              | Four variants, three sizes, loading/disabled, icons, full width, safe default `type="button"` | Async state management, confirmation logic |
| `IconButton`       | `<button>`                              | Required typed label, loading/disabled, minimum touch target                                  | Tooltip                                    |
| `Link`             | `<a>`                                   | External-tab indication and safe `rel` defaults                                               | Disabled/fake links, routing policy        |
| `TextInput`        | `<input>`                               | Supported textual types, invalid/read-only/disabled states, adornment readiness               | Validation, numeric domain parsing         |
| `Textarea`         | `<textarea>`                            | Resize policy, minimum height, state forwarding, `maxLength` readiness                        | Auto-resize, character counter             |
| `Select`           | `<select>`                              | Optional placeholder, invalid/required/disabled forwarding                                    | Searchable or multi-select                 |
| `Checkbox`         | `<input type="checkbox">`               | Label/help/error composition, invalid state, indeterminate DOM state                          | Business selection rules                   |
| `RadioGroup`       | `<fieldset>`, `<legend>`, native radios | Label/help/error, disabled options/group, vertical/horizontal layout                          | Custom roving-focus implementation         |
| `Switch`           | Checkbox with `role="switch"`           | Required label, visible on/off text, help/error, disabled/invalid                             | Settings persistence                       |
| `VisuallyHidden`   | `<span>`                                | Assistive-only content and focus-reveal CSS utility                                           | Skip-link routing                          |
| `FieldLabel`       | `<label>`                               | Required/optional markers and supporting text                                                 | Placeholder-only labels                    |
| `FieldDescription` | `<p>`                                   | Required stable ID for `aria-describedby`                                                     | Hidden critical instructions               |
| `FieldError`       | `<p>`                                   | Non-colour marker and optional live-region mode                                               | Error summary or validation                |
| `Field`            | `<div>` composition                     | Stable IDs and explicit render props for label/control/help/error state                       | Schema-driven forms or form state          |

`ShellNotice` and the token/brand metadata exports remain unchanged.

## Field composition

`Field` generates a stable control ID plus description/error IDs and passes only native control
attributes through its render function. The native control stays visible in source and owns its
semantics:

```tsx
<Field
  description="Explain the expected format before an error occurs."
  error={errorMessage}
  label="Example"
  required
>
  {(controlProps) => <TextInput {...controlProps} autoComplete="off" />}
</Field>
```

Use `FieldLabel`, `FieldDescription`, and `FieldError` directly when a layout cannot use `Field`.
Their IDs and the control’s `aria-describedby` must match. Use `errorLive="polite"` only for an
error that appears after interaction; avoid announcing errors already present on initial render.
Page-level validation summaries and focus movement after submission belong to the later form
foundation.

## Accessibility and interaction contract

- Use native controls and native keyboard behavior; never replace a link with a button or a button
  with a clickable container.
- Give every control a visible label. `IconButton.label` is required by TypeScript.
- Button defaults to `type="button"`; set `submit` or `reset` deliberately.
- Loading buttons are disabled, expose `aria-busy`, replace their accessible text with the loading
  label, and cannot activate twice.
- Errors use text, a marker, protected error tokens, `aria-invalid`, and `aria-describedby`.
- Required state uses a visible marker, assistive text, native `required`, and `aria-required`.
- Disabled controls remain native-disabled. Read-only applies only to controls that support the
  native attribute.
- All interactive controls use the protected global focus treatment. Icon buttons, choice labels,
  and switches preserve the proposed minimum touch target.
- Motion is brief and covered by the shared reduced-motion rule. Forced-colour styles retain
  borders, focus, and invalid-state cues.
- CSS uses logical properties for future Urdu/Arabic and RTL layouts. Leading/trailing adornments
  follow DOM order rather than physical left/right assumptions.
- Clinic brand tokens may style primary, secondary, link, and selected states. Error, destructive,
  invalid, focus, disabled, privacy, approval, and anatomical meanings remain protected.

These foundations target WCAG 2.2 AA principles where applicable, but unit tests and static policy
checks do not establish full conformance. Browser, assistive-technology, zoom/reflow, touch-device,
colour-vision, and high-contrast validation remain release evidence.

## Client and server boundaries

The UI-FOUNDATION-002 primitive set remains server-renderable except `Checkbox`; the later
`SearchField` adds a second form-level client boundary for local clear behavior. Other static
primitives remain renderable from Server Components when given serialisable/static props.
Interactive event handlers still require a client owner at the application boundary.

`Checkbox` is the single Client Component because the native `indeterminate` property can only be
set on the mounted DOM node. Its effect and internal ref do not add product state. React 19 ref
props are forwarded directly; legacy `forwardRef` wrappers are unnecessary.

## Next.js links

`Link` intentionally renders a standard anchor and requires `href`. That works for navigation and
progressive enhancement. Applications may later create an app-owned Next.js routing adapter with
the same visible/accessibility contract; the shared package does not depend on Next.js or expose a
polymorphic escape hatch.

## Testing and tooling

Tests use React Testing Library and `@testing-library/user-event` for pointer, label, tab, Enter,
Space, arrow-key, select, disabled, loading, read-only, invalid, and linkage behavior.
`corepack pnpm verify:ui-primitive-policy` checks exports, client boundaries, tests, logical CSS,
touch targets, protected tokens, prohibited dependencies, and product-scope names.

No axe dependency was added. At this foundation stage, explicit role/name/state/linkage and
keyboard tests provide more direct regression evidence without implying automated compliance.
Automated axe checks may be added with representative composed forms or browser testing after the
application accessibility test strategy is approved.

## Deferred behavior

Dialogs, drawers, tooltips, menus, date pickers, searchable/multi-select controls, tables, cards,
form libraries, validation summaries, schema-driven forms, product fields, clinical states, and
application routes remain outside UI-FOUNDATION-002.

## State-display components

UI-FOUNDATION-003 adds generic displays for communicating state without introducing product
screens, domain state machines, asynchronous jobs, or persistence.

| Category             | Public components                                                                                                             |
| -------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| Protected badges     | `StatusBadge`, `PrivacyBadge`, `ApprovalBadge`, `AIAssistedBadge`, `PatientSafeBadge`, `RestrictedBadge`                      |
| Loading and progress | `LoadingIndicator`, `LoadingBlock`, `ProcessingState`, `ProgressIndicator`, `Skeleton`                                        |
| Feedback panels      | `EmptyState`, `ErrorState`, `WarningState`, `SuccessState`, `PermissionDeniedState`, `SessionExpiredState`, `ScreenLockState` |
| Contextual messages  | `InlineMessage`, `Banner`                                                                                                     |

Actions are composition slots. Consumers should pass the existing `Button` or `Link` primitives;
the state surface itself is never clickable. Banner dismissal is intentionally absent until a
later task can define safe persistence and state ownership.

### Shared state taxonomy

- Operational: draft, pending, in progress, completed, failed, expired, revoked, archived.
- Clinical approval: review required, doctor approved, rejected, amended, superseded.
- Privacy: internal, doctor only, patient safe, temporary, masked, restricted.
- Connectivity and sync: online, weak connection, offline, saved on device, waiting to upload,
  uploading, synced, failed, session expired.

The package exports these display contracts as readonly values and string-literal types. They are
not application state machines and do not authorise transitions.

### State copy and privacy

Use universal labels such as “Review required,” “Access restricted,” and “Session expired” only
when their meaning is accurate. Contextual panels require consumer-supplied headings or
descriptions. Copy must say what happened and provide a safe next step without exposing identity,
record existence, tenant identifiers, permission internals, stack traces, secrets, support scope,
clinical recommendations, or unsupported saved/completed claims.

`PermissionDeniedState`, `SessionExpiredState`, and `ScreenLockState` contain no sensitive data by
default. Do not pass hidden resource details into them. Skeletons are generic placeholders and
must not be shaped to imply unavailable sensitive data.

### State accessibility and live regions

- Text and a visible marker communicate every protected meaning; colour and icons are
  supplementary.
- Informational `InlineMessage` and `Banner` instances are not alerts. Announcements are opt-in;
  only explicitly announced errors use assertive semantics.
- `LoadingIndicator` has an accessible label when standalone. `LoadingBlock` owns one polite,
  busy status region and makes its nested indicator decorative to prevent duplicate
  announcements.
- `ProgressIndicator` uses native `<progress>` semantics. Omit `value` for indeterminate progress;
  supplied values are clamped and visible percentages are rounded to avoid false precision.
- Skeleton shapes are hidden from the accessibility tree unless wrapped by their own explicit
  loading label.
- Action slots retain the keyboard and touch behavior of existing `Button` and `Link` primitives.
- Reduced-motion mode removes repeated motion; forced-colour mode restores system borders and
  text. Unit and static tests do not establish full WCAG conformance.

No axe dependency was added. The current tests directly verify roles, names, live-region choices,
native progress semantics, hidden decorative content, action focus/activation, and privacy-safe
defaults. Axe, browser, screen-reader, zoom/reflow, LED, RTL, and device testing remain later
integration evidence.

### Clinic-brand protection

Clinic brand values may decorate neutral information and safe links only. Error, warning,
restricted, doctor-approved, patient-safe, AI-assisted, expired-session, destructive, and focus
meanings use protected semantic tokens. State CSS never uses anatomical-region tokens or raw
protected colours.

### Client and server boundaries

All state-display components are Server Component compatible. None adds a `"use client"`
directive, hook, timer, browser API, global store, or job logic. A consumer that passes an event
handler must own that action in an appropriate Client Component. The indeterminate `Checkbox`,
local-clear `SearchField`, and clipboard-enabled `CopyableValue` are the package’s only
client-marked components.

### Out-of-scope state work

Product records, clinical entities, clinic and patient workflows, scan/upload/report/procedure
states, cards, tables, dialogs, drawers, navigation, dashboards, realtime status, persistence,
global state, broad icon systems, and state machines remain deferred.

## Data-entry primitives

UI-FOUNDATION-004 adds structured composition without adding a form system, validation schema, or
product field.

| Category       | Public components                                      | Contract                                                                                                             |
| -------------- | ------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------- |
| Structure      | `FieldGroup`, `FormSection`                            | Native fieldset/legend or labelled section, descriptions, actions/status, safe density and divider choices           |
| Affixes        | `InputGroup`, `InputPrefix`, `InputSuffix`             | Focus-within and protected states; decorative affixes are hidden while meaningful units remain describable           |
| Entry          | `SearchField`, `NumberField`, `DateField`, `TimeField` | Visible labels, linked help/errors, native or deliberately native-adjacent input behavior                            |
| Choice/display | `SegmentedControl`, `ReadOnlyField`                    | Native radios for two-to-five choices; static read-only content with empty, masked, restricted, and multiline states |

`SearchField` owns only its local clear behavior. It never sends a request or debounces input.
`SegmentedControl` is for small finite choices, not navigation. `InputPrefix` and `InputSuffix` are
non-interactive by default and do not invent hidden field actions.

### Native input strategy and raw-value preservation

`DateField` and `TimeField` render native `date` and `time` inputs. Their values use the browser
contracts (`YYYY-MM-DD` and 24-hour time strings), while browser and user locale determine the
visible control. Min, max, step, required, disabled, read-only, value, and error linkage are passed
through. There is no custom picker, scheduling behavior, or date library.

`NumberField` deliberately renders a text input with `inputMode="decimal"` or
`inputMode="numeric"`. Its controlled and default values are strings, so incomplete or invalid
entry remains exactly as supplied instead of becoming zero or losing leading/trailing digits.
Min, max, and step remain typed string constraint metadata for a future validation owner because
native text inputs do not enforce numeric constraints. The component does not validate, coerce,
round, calculate, add separators, or assume a decimal locale.

## Information primitives

| Category   | Public components                                | Contract                                                                                                              |
| ---------- | ------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------- |
| Lists      | `DefinitionList`, `KeyValueList`, `MetadataList` | Native `dl`/`dt`/`dd`, generic empty values, multiple values, responsive collapse                                     |
| Values     | `DataValue`, `Stat`                              | Consumer-controlled display strings, visible units/support, preliminary/status/trend slots, restrained sizing         |
| Content    | `DescriptionBlock`, `InformationPanel`           | Static labelled content, explicit heading levels, neutral composition and protected restricted/patient-safe readiness |
| References | `CopyableValue`, `ReferenceValue`                | Wrapping/monospace readiness, explicit accessible labels/actions, deliberate copying only                             |

These components do not format values or imply domain status. `Stat` is a typographic value
pattern, not a decorative dashboard card, chart, or animated result.

### Copy and masking safety

`ReadOnlyField` renders static content rather than a disabled input. Empty content defaults to
“Not provided.” When masked, the supplied value is not rendered; consumers control the generic
masked display and any separately composed copy action.

`CopyableValue` copies only after its labelled button is activated and reports generic success or
failure through a polite live region. By default it copies the displayed string. An unmasked value
can be copied only when the consumer explicitly supplies `copyValue`; that string is not inserted
into visible or hidden DOM content. Consumers must apply their own authorization and policy before
supplying it. `ReferenceValue` accepts only the display reference and an optional explicitly safe
accessible value; it must never receive secrets, access tokens, provider credentials, or database
keys.

## Layout primitives

| Primitive   | Contract                                                                                                 |
| ----------- | -------------------------------------------------------------------------------------------------------- |
| `Divider`   | Horizontal/vertical, decorative or labelled native separator semantics                                   |
| `Stack`     | Vertical layout with constrained token gaps, alignment, density, and full width                          |
| `Inline`    | Wrapping horizontal flow with constrained gaps, alignment, and justification                             |
| `Grid`      | One-to-four columns, named minimum-width readiness, and responsive collapse                              |
| `Container` | Narrow, standard, wide, or full content width with optional padding/centering                            |
| `Section`   | Surface-neutral labelled section with explicit heading level, action slot, density, and optional divider |

Layout APIs expose named choices rather than pixels or arbitrary style injection. CSS uses logical
properties, safe wrapping, long-value overflow handling, touch-target tokens, and responsive
breakpoints. Grids reduce columns, definition/key-value lists collapse, segmented controls stack,
and inline content wraps on constrained viewports. Presentation density is available only where
the existing density contract supports it.

## UI-FOUNDATION-004 client and server boundaries

`SearchField` is a Client Component for local clear/Escape behavior, and `CopyableValue` is a
Client Component for the clipboard API. The existing `Checkbox` remains client-marked for its
native indeterminate property. Every other data-entry, information, and layout component is
Server Component compatible when passed serialisable/static props. No global state, request,
timer, persistence, or product behavior was added.

## UI-FOUNDATION-004 usage limits

- Display strings, units, dates, times, number-like values, masked text, references, and status
  content are supplied by the consumer and are not automatically formatted.
- Application code owns validation, permission checks, copy authorization, locale formatting,
  product vocabulary, state transitions, and network behavior.
- Unit and static-policy tests verify semantics and regression contracts but do not guarantee
  WCAG conformance. Browser, assistive-technology, zoom/reflow, high-contrast, RTL, touch, and
  presentation-display evidence remain required later.
- Product forms, validation summaries/schemas, tables, cards, tabs, dashboards, records, reports,
  capture flows, application shells, and clinical screens remain out of scope.

`corepack pnpm verify:ui-information-policy` checks explicit exports, required files, native
semantics, minimal client boundaries, raw-string and copy-safety tests, logical/protected CSS,
documentation, dependencies, and the absence of product scope or formatting libraries.
