import { LegalDocumentScreen } from '@/components/legal-document-screen';
import { TERMS_OF_USE } from '@/lib/legal';

export default function TermsScreen() {
  return <LegalDocumentScreen document={TERMS_OF_USE} />;
}
