"use client";

import { useMemo, useState } from "react";
import { useFormStatus } from "react-dom";

import {
  Button,
  EmptyState,
  Field,
  Grid,
  Inline,
  SearchField,
  Select,
  Stat,
  StatusBadge,
  TextInput,
} from "@graftvision/ui";

import { HighRiskActionForm } from "./high-risk-action-form";

type ServerAction = (formData: FormData) => void | Promise<void>;
type ClinicStatus = "active" | "inactive" | "suspended";
type SessionStatus = "active" | "expired" | "locked" | "revoked" | "stale";

interface Clinic {
  readonly administrators: number;
  readonly clinicCode: string;
  readonly displayName: string;
  readonly id: string;
  readonly readinessRevision: number;
  readonly readinessState: string;
  readonly revision: number;
  readonly status: ClinicStatus;
  readonly timezone: string;
}

interface Dashboard {
  readonly activeClinics: number;
  readonly clinics: readonly Clinic[];
  readonly inactiveClinics: number;
  readonly notReadyClinics: number;
  readonly readyClinics: number;
  readonly suspendedClinics: number;
  readonly totalClinics: number;
}

interface PlatformUser {
  readonly authorizationVersion: number;
  readonly id: string;
  readonly platformRoles: readonly string[];
  readonly status: "active" | "archived" | "suspended";
}

interface PlatformSession {
  readonly createdAt: string;
  readonly expiresAt: string;
  readonly id: string;
  readonly lastActivityAt: string;
  readonly platformUserId: string;
  readonly revokedAt: string | null;
  readonly scope: "platform";
  readonly status: SessionStatus;
}

interface SessionHealth {
  readonly activeCount: number;
  readonly expiredCount: number;
  readonly lockedCount: number;
  readonly revokedCount: number;
  readonly sessions: readonly PlatformSession[];
  readonly staleCount: number;
  readonly users: readonly PlatformUser[];
}

interface AuditEvent {
  readonly action: string;
  readonly actorReference: string | null;
  readonly auditScope: string;
  readonly authorizationRevision: number | null;
  readonly clinicReference: string | null;
  readonly id: string;
  readonly occurredAt: string;
  readonly outcome: string;
  readonly reasonCode: string | null;
}

interface PlatformDashboardProps {
  readonly audit: readonly AuditEvent[];
  readonly clinicAction: ServerAction;
  readonly dashboard: Dashboard;
  readonly operationalAction: ServerAction;
  readonly sessionHealth: SessionHealth;
}

const statusLabels: Record<ClinicStatus, string> = {
  active: "Active",
  inactive: "Inactive",
  suspended: "Suspended",
};

const sessionStatusLabels: Record<SessionStatus, string> = {
  active: "Active",
  expired: "Expired",
  locked: "Locked",
  revoked: "Revoked",
  stale: "Needs renewal",
};

const actionLabels: Readonly<Record<string, string>> = {
  "clinic.create": "Clinic created",
  "clinic.inactivate": "Clinic marked inactive",
  "clinic.reactivate": "Clinic reactivated",
  "clinic.settings_update": "Clinic details updated",
  "clinic.suspend": "Clinic suspended",
  "membership.deactivate": "Membership deactivated",
  "membership.role_assign": "Role assigned",
  "membership.role_remove": "Role removed",
  "platform.admin": "Platform administration",
  "platform.session_revoke": "Platform session revoked",
  "platform.user_deactivate": "Platform user deactivated",
  "platform.user_reactivate": "Platform user reactivated",
  "session.create": "Signed in",
  "session.end": "Signed out",
  "session.revoke_other": "Session revoked",
  "session.revoke_others": "Other sessions revoked",
};

const reasonLabels: Readonly<Record<string, string>> = {
  FIRST_OWNER_BOOTSTRAPPED: "Platform Owner created",
  LOGOUT: "Signed out",
  PLATFORM_APPROVED: "Approved platform operation",
  PLATFORM_AUDIT_VIEWED: "Viewed platform audit",
  REVOKE_ALL: "All sessions revoked",
  REVOKE_ONE: "Selected session revoked",
};

function maskReference(value: string | null): string {
  if (!value) return "System";
  const compact = value.replaceAll("-", "");
  return `•••• ${compact.slice(-6)}`;
}

function friendlyDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Unavailable";
  return new Intl.DateTimeFormat("en-PK", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Karachi",
  }).format(date);
}

function titleCase(value: string): string {
  return value.length === 0 ? "Unknown" : value.charAt(0).toUpperCase() + value.slice(1);
}

function clinicStatusVariant(status: ClinicStatus) {
  return status === "active"
    ? "completed"
    : status === "suspended"
      ? "review-required"
      : "archived";
}

function sessionStatusVariant(status: SessionStatus) {
  if (status === "active") return "completed";
  if (status === "locked") return "restricted";
  if (status === "revoked") return "revoked";
  if (status === "expired") return "expired";
  return "review-required";
}

function PendingButton({
  children,
  disabled = false,
  variant = "primary",
}: {
  readonly children: React.ReactNode;
  readonly disabled?: boolean;
  readonly variant?: "primary" | "secondary";
}) {
  const { pending } = useFormStatus();
  return (
    <Button disabled={disabled || pending} type="submit" variant={variant}>
      {pending ? "Saving…" : children}
    </Button>
  );
}

function CreateClinicForm({ action }: { readonly action: ServerAction }) {
  const [clinicCode, setClinicCode] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [timezone, setTimezone] = useState("Asia/Karachi");
  const valid =
    /^[a-z0-9-]+$/u.test(clinicCode) &&
    displayName.trim().length > 0 &&
    /^[A-Za-z_]+(?:\/[A-Za-z0-9_+.-]+)+$/u.test(timezone);

  return (
    <form action={action} className="gv-platform-form">
      <input name="action" type="hidden" value="create" />
      <Grid columns={3} minimumItemWidth="small">
        <Field
          description="Lowercase letters, numbers and hyphens only."
          label="Clinic code"
          required
        >
          {(control) => (
            <TextInput
              {...control}
              autoComplete="off"
              maxLength={32}
              name="clinicCode"
              onChange={(event) => {
                setClinicCode(event.currentTarget.value);
              }}
              onInput={(event) => {
                setClinicCode(event.currentTarget.value);
              }}
              pattern="[a-z0-9-]+"
              placeholder="face-lhr"
              value={clinicCode}
            />
          )}
        </Field>
        <Field label="Clinic name" required>
          {(control) => (
            <TextInput
              {...control}
              autoComplete="organization"
              maxLength={120}
              name="displayName"
              onChange={(event) => {
                setDisplayName(event.currentTarget.value);
              }}
              onInput={(event) => {
                setDisplayName(event.currentTarget.value);
              }}
              placeholder="Clinic display name"
              value={displayName}
            />
          )}
        </Field>
        <Field description="A valid IANA timezone." label="Timezone" required>
          {(control) => (
            <TextInput
              {...control}
              autoComplete="off"
              name="timezone"
              onChange={(event) => {
                setTimezone(event.currentTarget.value);
              }}
              onInput={(event) => {
                setTimezone(event.currentTarget.value);
              }}
              pattern="[A-Za-z_]+(?:/[A-Za-z0-9_+.-]+)+"
              value={timezone}
            />
          )}
        </Field>
      </Grid>
      <Inline justify="end">
        <PendingButton disabled={!valid}>Create clinic</PendingButton>
      </Inline>
    </form>
  );
}

function ClinicActions({
  action,
  clinic,
}: {
  readonly action: ServerAction;
  readonly clinic: Clinic;
}) {
  return (
    <details className="gv-platform-details">
      <summary>Manage clinic</summary>
      <div className="gv-platform-details__content">
        <form action={action} className="gv-platform-form">
          <input name="action" type="hidden" value="metadata" />
          <input name="clinicId" type="hidden" value={clinic.id} />
          <input name="revision" type="hidden" value={clinic.revision} />
          <Grid columns={2}>
            <Field label="Clinic name" required>
              {(control) => (
                <TextInput
                  {...control}
                  defaultValue={clinic.displayName}
                  maxLength={120}
                  name="displayName"
                />
              )}
            </Field>
            <Field label="Timezone" required>
              {(control) => (
                <TextInput {...control} defaultValue={clinic.timezone} name="timezone" />
              )}
            </Field>
          </Grid>
          <Inline justify="end">
            <PendingButton variant="secondary">Save clinic details</PendingButton>
          </Inline>
        </form>

        <div className="gv-platform-action-group">
          <h4>Lifecycle</h4>
          <Inline>
            {clinic.status === "suspended" ? (
              <form action={action}>
                <input name="action" type="hidden" value="reactivate" />
                <input name="clinicId" type="hidden" value={clinic.id} />
                <PendingButton variant="secondary">Reactivate clinic</PendingButton>
              </form>
            ) : clinic.status === "active" ? (
              <HighRiskActionForm
                action={action}
                confirmation="This immediately denies clinic-scoped sessions."
                label="Suspend clinic"
                target={clinic.clinicCode}
              >
                <input name="action" type="hidden" value="suspend" />
                <input name="clinicId" type="hidden" value={clinic.id} />
              </HighRiskActionForm>
            ) : null}
            {clinic.status !== "inactive" ? (
              <HighRiskActionForm
                action={action}
                confirmation="Inactive clinics cannot be reactivated through the current lifecycle."
                label="Mark clinic inactive"
                target={clinic.clinicCode}
              >
                <input name="action" type="hidden" value="inactivate" />
                <input name="clinicId" type="hidden" value={clinic.id} />
              </HighRiskActionForm>
            ) : null}
          </Inline>
        </div>

        <div className="gv-platform-action-group">
          <h4>Clinic Administrator</h4>
          <form action={action} className="gv-platform-inline-form">
            <input name="action" type="hidden" value="assign" />
            <input name="clinicId" type="hidden" value={clinic.id} />
            <Field
              description="Enter the authorised platform user ID."
              label="Platform user ID"
              required
            >
              {(control) => (
                <TextInput
                  {...control}
                  autoComplete="off"
                  name="targetPlatformUserId"
                  placeholder="00000000-0000-0000-0000-000000000000"
                />
              )}
            </Field>
            <PendingButton variant="secondary">Assign administrator</PendingButton>
          </form>
          <Inline>
            <HighRiskActionForm
              action={action}
              confirmation="Existing Clinic Administrator assignments will be removed."
              label="Replace administrator"
              target={clinic.clinicCode}
            >
              <input name="action" type="hidden" value="replace" />
              <input name="clinicId" type="hidden" value={clinic.id} />
              <Field label="Replacement platform user ID" required>
                {(control) => (
                  <TextInput {...control} autoComplete="off" name="targetPlatformUserId" />
                )}
              </Field>
            </HighRiskActionForm>
            <HighRiskActionForm
              action={action}
              confirmation="The selected administrative assignment will be removed."
              label="Remove administrator"
              target={clinic.clinicCode}
            >
              <input name="action" type="hidden" value="remove" />
              <input name="clinicId" type="hidden" value={clinic.id} />
              <Field label="Administrator user ID" required>
                {(control) => (
                  <TextInput {...control} autoComplete="off" name="targetPlatformUserId" />
                )}
              </Field>
            </HighRiskActionForm>
          </Inline>
        </div>
      </div>
    </details>
  );
}

export function PlatformDashboardView({
  audit,
  clinicAction,
  dashboard,
  operationalAction,
  sessionHealth,
}: PlatformDashboardProps) {
  const [clinicQuery, setClinicQuery] = useState("");
  const [clinicStatus, setClinicStatus] = useState<"all" | ClinicStatus>("all");
  const [readiness, setReadiness] = useState<"all" | "ready" | "setup">("all");
  const [sessionStatus, setSessionStatus] = useState<"all" | SessionStatus>("all");
  const [auditOutcome, setAuditOutcome] = useState("all");

  const clinics = useMemo(() => {
    const query = clinicQuery.trim().toLocaleLowerCase("en");
    return dashboard.clinics.filter(
      (clinic) =>
        (clinicStatus === "all" || clinic.status === clinicStatus) &&
        (readiness === "all" ||
          (readiness === "ready"
            ? clinic.readinessState === "ready"
            : clinic.readinessState !== "ready")) &&
        (query.length === 0 ||
          clinic.displayName.toLocaleLowerCase("en").includes(query) ||
          clinic.clinicCode.toLocaleLowerCase("en").includes(query)),
    );
  }, [clinicQuery, clinicStatus, dashboard.clinics, readiness]);

  const sessions = useMemo(
    () =>
      sessionHealth.sessions.filter(
        (session) => sessionStatus === "all" || session.status === sessionStatus,
      ),
    [sessionHealth.sessions, sessionStatus],
  );

  const auditEvents = useMemo(
    () => audit.filter((event) => auditOutcome === "all" || event.outcome === auditOutcome),
    [audit, auditOutcome],
  );

  return (
    <div className="gv-platform-dashboard">
      <section aria-labelledby="overview-heading" className="gv-platform-section" id="overview">
        <div className="gv-platform-section__heading">
          <div>
            <p className="gv-platform-eyebrow">Platform overview</p>
            <h2 id="overview-heading">Operational summary</h2>
            <p>Review clinic readiness and platform access without entering tenant data.</p>
          </div>
        </div>
        <div className="gv-platform-stat-grid">
          <Stat label="Total clinics" size="large" value={dashboard.totalClinics} />
          <Stat label="Active clinics" size="large" value={dashboard.activeClinics} />
          <Stat label="Suspended" size="large" value={dashboard.suspendedClinics} />
          <Stat label="Ready clinics" size="large" value={dashboard.readyClinics} />
          <Stat label="Needs readiness work" size="large" value={dashboard.notReadyClinics} />
          <Stat label="Active platform sessions" size="large" value={sessionHealth.activeCount} />
        </div>
        <div className="gv-platform-getting-started">
          <div>
            <p className="gv-platform-eyebrow">Getting started</p>
            <h3>Create and prepare a clinic</h3>
          </div>
          <ol>
            <li>Create the clinic with its permanent code and timezone.</li>
            <li>Assign an approved Clinic Administrator.</li>
            <li>Review onboarding blockers until the clinic is ready.</li>
            <li>Clinic staff can sign in with their own clinic-scoped sessions.</li>
          </ol>
          <a className="gv-platform-text-link" href="#create-clinic">
            Create a clinic
          </a>
        </div>
      </section>

      <section aria-labelledby="clinics-heading" className="gv-platform-section" id="clinics">
        <div className="gv-platform-section__heading">
          <div>
            <p className="gv-platform-eyebrow">Clinic management</p>
            <h2 id="clinics-heading">Clinics</h2>
            <p>Search, review readiness and manage approved clinic-level administration.</p>
          </div>
        </div>
        <div className="gv-platform-filter-bar">
          <SearchField
            fullWidth
            label="Search clinics"
            onValueChange={setClinicQuery}
            placeholder="Search by clinic name or code"
            value={clinicQuery}
          />
          <Field label="Lifecycle status">
            {(control) => (
              <Select
                {...control}
                onChange={(event) => {
                  setClinicStatus(event.currentTarget.value as "all" | ClinicStatus);
                }}
                value={clinicStatus}
              >
                <option value="all">All statuses</option>
                <option value="active">Active</option>
                <option value="suspended">Suspended</option>
                <option value="inactive">Inactive</option>
              </Select>
            )}
          </Field>
          <Field label="Readiness">
            {(control) => (
              <Select
                {...control}
                onChange={(event) => {
                  setReadiness(event.currentTarget.value as "all" | "ready" | "setup");
                }}
                value={readiness}
              >
                <option value="all">All readiness states</option>
                <option value="ready">Ready</option>
                <option value="setup">Setup required</option>
              </Select>
            )}
          </Field>
        </div>

        {clinics.length === 0 ? (
          <EmptyState
            description="Try a different name, code or lifecycle filter."
            heading="No clinics match this view"
          />
        ) : (
          <div className="gv-platform-card-grid">
            {clinics.map((clinic) => (
              <article className="gv-platform-clinic-card" key={clinic.id}>
                <div className="gv-platform-card__heading">
                  <div>
                    <h3>{clinic.displayName}</h3>
                    <p>{clinic.clinicCode}</p>
                  </div>
                  <StatusBadge
                    label={statusLabels[clinic.status]}
                    size="small"
                    variant={clinicStatusVariant(clinic.status)}
                  />
                </div>
                <dl className="gv-platform-summary-list">
                  <div>
                    <dt>Readiness</dt>
                    <dd>
                      <StatusBadge
                        label={clinic.readinessState === "ready" ? "Ready" : "Setup required"}
                        size="small"
                        variant={clinic.readinessState === "ready" ? "completed" : "pending"}
                      />
                    </dd>
                  </div>
                  <div>
                    <dt>Administrators</dt>
                    <dd>{clinic.administrators}</dd>
                  </div>
                  <div>
                    <dt>Timezone</dt>
                    <dd>{clinic.timezone}</dd>
                  </div>
                  <div>
                    <dt>Revision</dt>
                    <dd>{clinic.revision}</dd>
                  </div>
                </dl>
                <ClinicActions action={clinicAction} clinic={clinic} />
              </article>
            ))}
          </div>
        )}

        <div className="gv-platform-create-card" id="create-clinic">
          <div>
            <p className="gv-platform-eyebrow">New clinic</p>
            <h3>Create clinic</h3>
            <p>Only the approved operational identity fields are collected here.</p>
          </div>
          <CreateClinicForm action={clinicAction} />
        </div>
      </section>

      <section aria-labelledby="users-heading" className="gv-platform-section" id="platform-users">
        <div className="gv-platform-section__heading">
          <div>
            <p className="gv-platform-eyebrow">Access governance</p>
            <h2 id="users-heading">Platform users</h2>
            <p>Manage platform eligibility without exposing account credentials or tenant data.</p>
          </div>
        </div>
        {sessionHealth.users.length === 0 ? (
          <EmptyState
            description="Platform users will appear after controlled bootstrap or assignment."
            heading="No platform users"
          />
        ) : (
          <div className="gv-platform-table-wrap">
            <table className="gv-platform-table">
              <caption className="gv-visually-hidden">Platform users and access controls</caption>
              <thead>
                <tr>
                  <th scope="col">User</th>
                  <th scope="col">Role</th>
                  <th scope="col">Status</th>
                  <th scope="col">Actions</th>
                </tr>
              </thead>
              <tbody>
                {sessionHealth.users.map((user) => (
                  <tr key={user.id}>
                    <td data-label="User">
                      <span className="gv-platform-masked">{maskReference(user.id)}</span>
                    </td>
                    <td data-label="Role">
                      {user.platformRoles.join(", ").replaceAll("_", " ") || "No active role"}
                    </td>
                    <td data-label="Status">
                      <StatusBadge
                        label={titleCase(user.status)}
                        size="small"
                        variant={user.status === "active" ? "completed" : "restricted"}
                      />
                    </td>
                    <td data-label="Actions">
                      <Inline>
                        {user.status === "active" ? (
                          <HighRiskActionForm
                            action={operationalAction}
                            confirmation="The account becomes ineligible and its platform sessions are revoked."
                            label="Deactivate"
                            target={maskReference(user.id)}
                          >
                            <input name="action" type="hidden" value="deactivate" />
                            <input name="targetPlatformUserId" type="hidden" value={user.id} />
                            <input
                              name="authorizationVersion"
                              type="hidden"
                              value={user.authorizationVersion}
                            />
                          </HighRiskActionForm>
                        ) : (
                          <form action={operationalAction}>
                            <input name="action" type="hidden" value="reactivate" />
                            <input name="confirmed" type="hidden" value="yes" />
                            <input name="reasonCode" type="hidden" value="ACCOUNT_RESTORED" />
                            <input name="targetPlatformUserId" type="hidden" value={user.id} />
                            <input
                              name="authorizationVersion"
                              type="hidden"
                              value={user.authorizationVersion}
                            />
                            <Button size="small" type="submit" variant="quiet">
                              Reactivate
                            </Button>
                          </form>
                        )}
                        <HighRiskActionForm
                          action={operationalAction}
                          confirmation="Every active platform session for this user will be revoked."
                          label="Revoke sessions"
                          target={maskReference(user.id)}
                        >
                          <input name="action" type="hidden" value="revoke-all" />
                          <input name="targetPlatformUserId" type="hidden" value={user.id} />
                        </HighRiskActionForm>
                      </Inline>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section aria-labelledby="sessions-heading" className="gv-platform-section" id="sessions">
        <div className="gv-platform-section__heading">
          <div>
            <p className="gv-platform-eyebrow">Session monitoring</p>
            <h2 id="sessions-heading">Platform sessions</h2>
            <p>Review platform authority sessions and revoke selected access when required.</p>
          </div>
        </div>
        <div className="gv-platform-filter-bar gv-platform-filter-bar--compact">
          <Field label="Session status">
            {(control) => (
              <Select
                {...control}
                onChange={(event) => {
                  setSessionStatus(event.currentTarget.value as "all" | SessionStatus);
                }}
                value={sessionStatus}
              >
                <option value="all">All sessions</option>
                <option value="active">Active</option>
                <option value="locked">Locked</option>
                <option value="stale">Needs renewal</option>
                <option value="expired">Expired</option>
                <option value="revoked">Revoked</option>
              </Select>
            )}
          </Field>
          <p className="gv-platform-filter-summary" role="status">
            {sessions.length} session{sessions.length === 1 ? "" : "s"} shown
          </p>
        </div>
        {sessions.length === 0 ? (
          <EmptyState
            description="No platform sessions match the selected status."
            heading="No sessions in this view"
          />
        ) : (
          <div className="gv-platform-table-wrap">
            <table className="gv-platform-table">
              <caption className="gv-visually-hidden">Platform session health</caption>
              <thead>
                <tr>
                  <th scope="col">Session</th>
                  <th scope="col">User</th>
                  <th scope="col">Status</th>
                  <th scope="col">Last activity</th>
                  <th scope="col">Expires</th>
                  <th scope="col">Action</th>
                </tr>
              </thead>
              <tbody>
                {sessions.map((healthSession) => (
                  <tr key={healthSession.id}>
                    <td className="gv-platform-masked" data-label="Session">
                      {maskReference(healthSession.id)}
                    </td>
                    <td className="gv-platform-masked" data-label="User">
                      {maskReference(healthSession.platformUserId)}
                    </td>
                    <td data-label="Status">
                      <StatusBadge
                        label={sessionStatusLabels[healthSession.status]}
                        size="small"
                        variant={sessionStatusVariant(healthSession.status)}
                      />
                    </td>
                    <td data-label="Last activity">
                      <time dateTime={healthSession.lastActivityAt}>
                        {friendlyDate(healthSession.lastActivityAt)}
                      </time>
                    </td>
                    <td data-label="Expires">
                      <time dateTime={healthSession.expiresAt}>
                        {friendlyDate(healthSession.expiresAt)}
                      </time>
                    </td>
                    <td data-label="Action">
                      {healthSession.status !== "revoked" ? (
                        <HighRiskActionForm
                          action={operationalAction}
                          confirmation="Only this selected platform session will be revoked."
                          label="Revoke"
                          target={maskReference(healthSession.id)}
                        >
                          <input name="action" type="hidden" value="revoke-one" />
                          <input
                            name="targetPlatformUserId"
                            type="hidden"
                            value={healthSession.platformUserId}
                          />
                          <input name="targetSessionId" type="hidden" value={healthSession.id} />
                        </HighRiskActionForm>
                      ) : (
                        <span className="gv-platform-muted">No action</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section aria-labelledby="audit-heading" className="gv-platform-section" id="audit">
        <div className="gv-platform-section__heading">
          <div>
            <p className="gv-platform-eyebrow">Accountability</p>
            <h2 id="audit-heading">Recent platform audit</h2>
            <p>Operational evidence is shown with masked references and controlled labels.</p>
          </div>
        </div>
        <div className="gv-platform-filter-bar gv-platform-filter-bar--compact">
          <Field label="Outcome">
            {(control) => (
              <Select
                {...control}
                onChange={(event) => {
                  setAuditOutcome(event.currentTarget.value);
                }}
                value={auditOutcome}
              >
                <option value="all">All outcomes</option>
                <option value="success">Successful</option>
                <option value="denied">Denied</option>
                <option value="failure">Failed</option>
              </Select>
            )}
          </Field>
        </div>
        {auditEvents.length === 0 ? (
          <EmptyState
            description="No platform audit events match the selected outcome."
            heading="No audit events in this view"
          />
        ) : (
          <ol className="gv-platform-audit-list">
            {auditEvents.map((event) => (
              <li key={event.id}>
                <div className="gv-platform-audit-list__marker" aria-hidden="true">
                  {event.outcome === "success" ? "✓" : "!"}
                </div>
                <div>
                  <div className="gv-platform-card__heading">
                    <h3>{actionLabels[event.action] ?? event.action.replaceAll(".", " ")}</h3>
                    <StatusBadge
                      label={titleCase(event.outcome)}
                      size="small"
                      variant={event.outcome === "success" ? "completed" : "restricted"}
                    />
                  </div>
                  <p>
                    Actor {maskReference(event.actorReference)}
                    {event.clinicReference
                      ? ` · Clinic ${maskReference(event.clinicReference)}`
                      : " · Platform scope"}
                  </p>
                  <p className="gv-platform-muted">
                    <time dateTime={event.occurredAt}>{friendlyDate(event.occurredAt)}</time>
                    {event.reasonCode
                      ? ` · ${reasonLabels[event.reasonCode] ?? titleCase(event.reasonCode.replaceAll("_", " ").toLocaleLowerCase("en"))}`
                      : ""}
                  </p>
                </div>
              </li>
            ))}
          </ol>
        )}
      </section>
    </div>
  );
}

export { maskReference };
