import { LegalDocumentScreen } from '@/components/legal-document-screen';
import { PRIVACY_POLICY } from '@/lib/legal';

export default function PrivacyScreen() {
  return <LegalDocumentScreen document={PRIVACY_POLICY} />;
}
