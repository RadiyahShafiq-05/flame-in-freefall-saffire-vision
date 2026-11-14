import PageHeader from "@/components/PageHeader";
import EmptyState from "@/components/EmptyState";

export default function Investigations() {
  return (
    <div className="space-y-6">
      <PageHeader title="Combustion Investigations"
        subtitle="NASA's microgravity combustion investigations in the Physical Sciences Informatics repository, with their hardware, test conditions and data." />
      <EmptyState title="This page is planned for a later milestone"
        body="It will list NASA's combustion investigations with links to their data and publications. Until then, browse them on NASA PSI."
        action={<a className="btn" href="https://psi.nasa.gov/physci/repo/search?q=combustion" target="_blank" rel="noreferrer">Open NASA PSI combustion search</a>} />
    </div>
  );
}
