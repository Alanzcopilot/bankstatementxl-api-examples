# BankStatementXL with Zapier: five ready recipes

Each recipe turns statements that arrive by email or in a folder into checked rows and files, with no uploading or
downloading by hand. They use the BankStatementXL app on Zapier (by invitation for now) and Zapier's own apps. Step
names are exactly as Zapier shows them (checked 8 November 2026).

**Before you start**
1. Add BankStatementXL to your Zapier account: on bankstatementxl.com, open **Settings → Developers** and click
   **Add BankStatementXL to Zapier** (Zapier's invitation page), then accept.
2. A BankStatementXL plan with the API: Pro or Business, or the free trial (free for 14 days, no credit card required).
3. An API key from **Settings → Developers** on bankstatementxl.com. Zapier asks for it once, when you connect
   BankStatementXL.
4. In each recipe, **Convert a Statement** gives you the statement's rows (date, description, amount, balance) and one
   file in the format you pick: Excel, CSV, QuickBooks Online (CSV), QuickBooks Desktop (IIF), Xero, OFX, QIF, Tally,
   Sage, MYOB or NetSuite.
5. Test with one statement, then switch the Zap on. Each statement uses its pages once, when it converts.

**Long scans.** If a statement takes longer than Zapier waits, the Zap stops with "still converting" and nothing is
charged. For long scans, use the **Statement Converted** trigger with **Download a Converted Statement**.

---

## 1. Gmail → Google Sheets, Google Drive and an email

For: statements clients email to you.

1. **Gmail · New Attachment.** Tip: use a label or search such as `has:attachment filename:pdf` so only statements
   start the Zap.
2. **BankStatementXL · Convert a Statement.** Statement file: the attachment. File format: the one you import
   (for example QuickBooks Online (CSV) or Excel). Wait for the result: Yes.
3. **Google Sheets · Create Multiple Spreadsheet Rows.** Map Row date, Row description, Row amount and Row balance to
   your columns.
4. **Google Drive · Upload File.** File: the File from step 2. Folder: where you keep converted statements.
5. **Gmail · Send Email** to yourself: "{{File name}}: {{Rows}} rows, {{Rows not adding up}} not adding up, totals
   match: {{Totals match}}".

## 2. Outlook → Excel, OneDrive and an email

For: statements that arrive in Outlook or Microsoft 365.

1. **Microsoft Outlook · New Attachment.**
2. **BankStatementXL · Convert a Statement**, as above.
3. **Microsoft Excel · Add Row(s).** Map the row fields to your table. Zapier's Excel works only with workbooks on
   OneDrive for Business (Microsoft 365).
4. **OneDrive · Upload File.** File: the File from step 2.
5. **Microsoft Outlook · Send Email** to yourself, with the rows and checks as in recipe 1.

## 3. A Google Drive folder → Google Drive, Google Sheets and Slack

For: a shared "Statements in" folder you and your clients drop files into.

1. **Google Drive · New File in Folder** ("Statements in").
2. **BankStatementXL · Convert a Statement.** Statement file: the file from step 1.
3. **Google Drive · Upload File** to a "Converted" folder.
4. **Google Sheets · Create Multiple Spreadsheet Rows**, as in recipe 1.
5. **Google Drive · Move File:** the original into a "Processed" folder.
6. **Slack · Send Channel Message:** "{{File name}} converted: {{Rows}} rows, {{Rows not adding up}} not adding up."

## 4. A Dropbox folder → Dropbox and Slack

For: teams that keep client files in Dropbox.

1. **Dropbox · New File in Folder** ("Statements in").
2. **BankStatementXL · Convert a Statement.**
3. **Dropbox · Upload File** to a "Converted" folder.
4. **Dropbox · Move File:** the original into a "Processed" folder.
5. **Slack · Send Channel Message**, as in recipe 3.

## 5. A OneDrive folder → OneDrive, Excel and an email

For: firms on Microsoft 365.

1. **OneDrive · New File** (in your "Statements in" folder).
2. **BankStatementXL · Convert a Statement.**
3. **OneDrive · Upload File** to a "Converted" folder.
4. **Microsoft Excel · Add Row(s)**, as in recipe 2.
5. **Microsoft Outlook · Send Email**, as in recipe 2.

---

**If something stops a Zap,** its history shows our message in plain words, for example "Your BankStatementXL balance
doesn't cover this statement; nothing was charged". Fix it, then replay the run.

**QuickBooks and Xero:** these recipes deliver the ready import file (QuickBooks Online CSV, QuickBooks Desktop IIF or
Xero CSV) to your folder; you import it in QuickBooks or Xero as usual. No app can place statement lines straight into
QuickBooks' or Xero's bank feed.
