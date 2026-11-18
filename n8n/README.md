# n8n templates for BankStatementXL

Five ready-made workflows for n8n (version 2; tested on 2.45.3). In n8n, open Workflows, then ⋯ → Import from file.
Each one sends your statements to BankStatementXL, saves the files you choose, and tells you when it's done. They
all share the same BankStatementXL part, so they behave the same way: a statement uses its pages once, at the first
download; one that can't be converted costs nothing; and it is deleted from BankStatementXL as soon as its files are
saved. If something goes wrong (no pages left, a file that isn't a statement), the run stops with BankStatementXL's
own message, which you see on the red node and under Executions.

## Set up any of them in 5 steps
Each workflow has these steps in a note on its canvas.
1. **Your BankStatementXL key.** On bankstatementxl.com, open Settings → Developers and create a key. In n8n, open
   the node **Upload statement** and click Connect to Header Auth. Name it `BankStatementXL API key`, enter Name
   `Authorization` and Value `Bearer ` followed by your key, and save. n8n puts it on the other BankStatementXL
   nodes too.
2. **Your other accounts.** Connect your Gmail, Google, Microsoft, Dropbox or Slack account in the nodes that use it.
3. **Settings – edit me.** `formats` is the list of files to make, separated by commas: `xlsx` (Excel, the default
   with `qbo-csv`), `csv`, `qbo-csv` (QuickBooks Online), `xero`, `iif` (QuickBooks Desktop), `ofx`, `qbo-ofx`,
   `qif` (Quicken), `tally`, `sage`, `zoho` (Zoho Books), `wave`, `freshbooks`, `myob`, `netsuite` and `json`. Then
   the folders, the sheet and where the message
   goes. QBO and QFX files aren't made here, because they need your bank's Intuit bank ID: use `qbo-csv`, `iif` or
   `ofx`.
4. **Test with one statement.** Click Execute at the bottom of the canvas, then send or drop one statement.
5. **Switch it on.** Click Publish (top right; on older n8n, turn on Active).

## The five workflows
- **`gmail-to-google-sheets-and-drive.json`**: when an email with a statement arrives in Gmail (the search
  `has:attachment filename:pdf`, which you can change), each PDF or photo is converted. The files go to a Google
  Drive folder, every transaction is added to a Google Sheet, and you get an email with the rows, the rows that
  don't add up, whether the totals match and links to the folder and the sheet. Needs: Gmail, Google Drive, Google
  Sheets.
- **`outlook-to-excel-and-onedrive.json`**: the same for Outlook. The files go to a OneDrive folder, the
  transactions are added to a table in an Excel workbook (make the table with the headings Statement, Date,
  Description, Amount, Balance, Category and Note; a new table starts with one empty row, which you can delete),
  and Outlook emails you the result. Needs: one Microsoft account for Outlook, OneDrive and Excel, with a mailbox
  and OneDrive (a personal Outlook.com account or a Microsoft 365 account with a licence).
- **`google-drive-folder-to-sheets.json`**: drop a statement into a Google Drive folder you choose. The files go to
  a second, "converted" folder, the transactions are added to a Google Sheet, and Slack tells you. Needs: Google
  Drive, Google Sheets, Slack.
- **`dropbox-folder.json`**: n8n has no Dropbox trigger, so this one looks in an "inbox" folder every 15 minutes.
  Each new statement is converted, its files go to a "converted" folder, the original moves to a "processed" folder
  (so it's never converted twice), and Slack tells you. A file that can't be converted stays in the inbox until you
  move it. Needs: Dropbox, Slack. On self-hosted n8n, tick files.metadata and files.content (read and write) on
  your Dropbox app's Permissions tab before you connect it. The Slack message links to the folder for a Full
  Dropbox app; with an App folder app, the folders are under Apps → your app's name.
- **`onedrive-folder.json`**: drop a statement into a OneDrive folder. The files go to a "converted" folder, the
  transactions are added to an Excel table (headings as above), and Outlook emails you the result. Needs: one
  Microsoft account for OneDrive, Excel and Outlook.

PDFs, scans and phone photos (JPG, PNG, HEIC, TIFF) are sent; other attachments and files are left alone. Each photo
counts as its own statement.
