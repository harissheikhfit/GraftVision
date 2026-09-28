import { EmptyState } from "@graftvision/ui";

export default function ConsultationNotFound() {
  return (
    <EmptyState
      description="The consultation does not exist or is not available in this clinic context."
      heading="Consultation not found"
    />
  );
}
