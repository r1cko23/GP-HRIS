# Logo Assets

This folder contains the source logo files for Green Pasture People Management Inc.

## Files

- `GP LOGO (1).png` - Source logo file (PNG format)

## Usage

The logo is converted to WebP format and placed in `/public/gp-logo.webp` for use in the application.

### Logo Specifications

- **Format:** WebP (optimized for web)
- **Location:** `/public/gp-logo.webp`
- **Dimensions:** 500x98 pixels (tight crop; aspect ratio ~5.1:1)
- **File Size:** ~12KB

### Where Logo is Used

1. **Login Page** (`app/login/LoginPageClient.tsx`)

   - Size: `h-24` (96px height, auto width)

2. **Topbar** (`components/Header.tsx` via `.topbar-logo-plate`)

   - Plate: `h-12` (48px); image: `h-11` (44px), max-width 12rem

3. **Admin/HR Sidebar** (`components/Sidebar.tsx`)

   - Size: `h-[3.5rem]` (56px height, auto width)

4. **Employee Portal Sidebar** (`components/EmployeePortalSidebar.tsx`)

   - Size: `h-8` (32px height, max-width 140px)

4. **Payslip Print** (`components/PayslipPrint.tsx`)

   - Size: 80px height, auto width

5. **Multi-Payslip Print** (`components/PayslipMultiPrint.tsx`)
   - Size: 24px height, auto width (compact format)

## Updating the Logo

To update the logo:

1. Replace `GP LOGO (1).png` with the new logo file
2. Convert to WebP:
   ```bash
   convert "GP LOGO (1).png" -quality 90 -resize 500x500 public/gp-logo.webp
   ```
3. All references will automatically use the new logo

---

**Last Updated:** December 18, 2025