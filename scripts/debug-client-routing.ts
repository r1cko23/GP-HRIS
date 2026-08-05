import fs from "fs";
import { peekRegisterClientName } from "../lib/payroll-summary/peek-register-client";
import { extractPdfText } from "../lib/payroll-summary/extract-pdf-text";
import { extractCompanyName } from "../lib/payroll-summary/parse-payroll-register-pdf";

const files = process.argv.slice(2);

async function main() {
  for (const fileName of files) {
    if (!fs.existsSync(fileName)) {
      console.log(fileName, "MISSING");
      continue;
    }
    const buffer = fs.readFileSync(fileName);
    const text = await extractPdfText(buffer);
    const peek = await peekRegisterClientName({ buffer, fileName });
    console.log(
      JSON.stringify({
        fileName,
        rawCompany: extractCompanyName(text),
        clientNameLine: text.match(/Client\s*Name\s*:[^\n\r]{0,120}/i)?.[0],
        headerCompanyLine: text.match(/[A-Z][A-Z0-9 .,&'\/-]{6,90}INC\.?[^\n]{0,60}/)?.[0],
        routed: peek,
      })
    );
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
