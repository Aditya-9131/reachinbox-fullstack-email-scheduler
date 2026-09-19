import { parse } from 'csv-parse/sync';

const EMAIL_REGEX = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;

export interface ParsedLead {
  email: string;
  name?: string;
  company?: string;
  [key: string]: any;
}

export const parseLeadsFile = (fileBuffer: Buffer, fileName: string): { emails: string[]; leads: ParsedLead[] } => {
  const content = fileBuffer.toString('utf-8');
  const emailsSet = new Set<string>();
  const leads: ParsedLead[] = [];

  // If CSV format
  if (fileName.endsWith('.csv') || content.includes(',')) {
    try {
      const records: any[] = parse(content, {
        columns: true,
        skip_empty_lines: true,
        trim: true,
      });

      for (const record of records) {
        // Look for common email column names
        const emailKey = Object.keys(record).find((k) =>
          ['email', 'e-mail', 'mail', 'emailaddress', 'email_address'].includes(k.toLowerCase().trim())
        );

        let email = emailKey ? record[emailKey] : null;

        // If no explicit column, regex scan the record values
        if (!email) {
          const match = JSON.stringify(record).match(EMAIL_REGEX);
          if (match && match.length > 0) email = match[0];
        }

        if (email && email.includes('@')) {
          const cleanEmail = email.toLowerCase().trim();
          if (!emailsSet.has(cleanEmail)) {
            emailsSet.add(cleanEmail);
            leads.push({
              email: cleanEmail,
              name: record.name || record.first_name || record.fullName || '',
              company: record.company || record.organization || '',
              ...record,
            });
          }
        }
      }
    } catch {
      // Fallback to raw regex extraction
      const matches = content.match(EMAIL_REGEX) || [];
      for (const m of matches) {
        const clean = m.toLowerCase().trim();
        if (!emailsSet.has(clean)) {
          emailsSet.add(clean);
          leads.push({ email: clean });
        }
      }
    }
  } else {
    // Plain text line-by-line or comma/space separated
    const matches = content.match(EMAIL_REGEX) || [];
    for (const m of matches) {
      const clean = m.toLowerCase().trim();
      if (!emailsSet.has(clean)) {
        emailsSet.add(clean);
        leads.push({ email: clean });
      }
    }
  }

  return {
    emails: Array.from(emailsSet),
    leads,
  };
};
