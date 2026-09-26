import { GuidePage } from '../../guide/GuidePage';

export function CompanyGuideSection({ companyId }: { companyId: string }) {
  return <GuidePage companyId={companyId} />;
}
