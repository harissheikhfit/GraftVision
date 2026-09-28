import Link from "next/link";
import { redirect } from "next/navigation";

import {
  createRequestAuthClient,
  getActiveApplicationSession,
  getCurrentUser,
  requireVerifiedAuthSession,
} from "@graftvision/auth/server";
import { createDatabasePool, searchPatients } from "@graftvision/database";
import {
  Button,
  ClinicShell,
  DateField,
  EmptyState,
  Field,
  InlineMessage,
  Section,
  Select,
  ShellNavigation,
  ShellNavigationItem,
  ShellToolbar,
  Stack,
  TextInput,
} from "@graftvision/ui";

import { SessionActivityBoundary } from "../../../session-activity-boundary";

export const dynamic = "force-dynamic";

interface PatientListPageProps {
  readonly searchParams: Promise<Record<string, string | string[] | undefined>>;
}

function one(value: string | string[] | undefined): string | undefined {
  return typeof value === "string" ? value : undefined;
}

function pageHref(
  filters: Record<string, string | undefined>,
  cursor: string,
  direction: "next" | "previous",
): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(filters)) {
    if (value) params.set(key, value);
  }
  params.set("cursor", cursor);
  params.set("direction", direction);
  return `/clinic/patients?${params.toString()}`;
}

export default async function PatientListPage({ searchParams }: PatientListPageProps) {
  const authClient = await createRequestAuthClient();
  await requireVerifiedAuthSession(authClient, "clinic").catch(() => redirect("/login"));
  const [user, session, parameters] = await Promise.all([
    getCurrentUser(authClient),
    getActiveApplicationSession(),
    searchParams,
  ]);
  if (!session || session.authorityScope !== "clinic" || session.clinicId !== user.clinicId) {
    redirect("/locked");
  }
  const query = one(parameters.query);
  const requestedStatus = one(parameters.status);
  const status =
    requestedStatus === "inactive" || requestedStatus === "archived" ? requestedStatus : "active";
  const createdFrom = one(parameters.createdFrom);
  const createdTo = one(parameters.createdTo);
  const cursor = one(parameters.cursor);
  const direction = one(parameters.direction) === "previous" ? "previous" : "next";
  const pool = createDatabasePool();
  let result: Awaited<ReturnType<typeof searchPatients>> | null = null;
  let denied = false;
  try {
    result = await searchPatients(pool, {
      applicationSessionId: session.id,
      providerIdentityId: user.platformUserId,
      ...(query ? { query } : {}),
      status,
      ...(createdFrom ? { createdFrom } : {}),
      ...(createdTo ? { createdTo } : {}),
      ...(cursor ? { cursor } : {}),
      direction,
    });
  } catch {
    denied = true;
  } finally {
    await pool.end().catch(() => undefined);
  }
  const filters = { createdFrom, createdTo, query, status };
  return (
    <SessionActivityBoundary lastActivityAt={session.lastActivityAt.toISOString()}>
      <ClinicShell
        navigation={
          <ShellNavigation label="Clinic navigation">
            <ShellNavigationItem href="/clinic" label="Clinic" />
            <ShellNavigationItem active href="/clinic/patients" label="Patients" />
            <ShellNavigationItem href="/clinic/patients/register" label="Register patient" />
            <ShellNavigationItem href="/clinic/onboarding" label="Onboarding" />
          </ShellNavigation>
        }
        toolbar={<ShellToolbar title={<h1>Patients</h1>} />}
      >
        <Section heading="Find patients">
          <form action="/clinic/patients" method="get">
            <Stack gap="3">
              <Field
                description="Search this clinic by patient number, name, international phone, or email."
                label="Search"
              >
                {(control) => (
                  <TextInput
                    {...control}
                    defaultValue={query}
                    maxLength={160}
                    name="query"
                    type="search"
                  />
                )}
              </Field>
              <Field label="Status">
                {(control) => (
                  <Select {...control} defaultValue={status} name="status">
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                    <option value="archived">Archived</option>
                  </Select>
                )}
              </Field>
              <DateField defaultValue={createdFrom} label="Created from" name="createdFrom" />
              <DateField defaultValue={createdTo} label="Created to" name="createdTo" />
              <Button type="submit">Apply search</Button>
            </Stack>
          </form>
        </Section>
        <Section heading="Masked patient results">
          {denied || !result ? (
            <InlineMessage announce title="Patient search unavailable" variant="error">
              The request was denied or could not be completed. Check your access and filters.
            </InlineMessage>
          ) : result.patients.length === 0 ? (
            <EmptyState
              description="No patients match the approved clinic filters."
              heading="No patients found"
            />
          ) : (
            <>
              <ul aria-label="Patient search results">
                {result.patients.map((patient) => (
                  <li key={patient.id}>
                    <Link
                      href={`/clinic/patients/${patient.id}${
                        patient.lifecycleState === "archived"
                          ? "?includeArchived=true"
                          : patient.status === "inactive"
                            ? "?includeInactive=true"
                            : ""
                      }`}
                    >
                      {patient.patientNumber}
                    </Link>{" "}
                    · {patient.maskedName} · {patient.hasPhone ? "phone on file" : "no phone"} ·{" "}
                    {patient.hasEmail ? "email on file" : "no email"} ·{" "}
                    {patient.lifecycleState === "archived" ? "archived" : patient.status} · created{" "}
                    <time dateTime={patient.createdAt}>
                      {new Date(patient.createdAt).toLocaleDateString("en-PK")}
                    </time>
                  </li>
                ))}
              </ul>
              <nav aria-label="Patient result pages">
                {result.previousCursor ? (
                  <Link href={pageHref(filters, result.previousCursor, "previous")}>
                    Previous page
                  </Link>
                ) : null}
                {result.nextCursor ? (
                  <Link href={pageHref(filters, result.nextCursor, "next")}>Next page</Link>
                ) : null}
              </nav>
            </>
          )}
        </Section>
      </ClinicShell>
    </SessionActivityBoundary>
  );
}
