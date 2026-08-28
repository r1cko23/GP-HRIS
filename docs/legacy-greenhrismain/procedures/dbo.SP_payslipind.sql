-- =============================================
-- Author:		<Pat Relos>
-- Create date: <9-15-2024>
-- Description:	<use in datagrid view list employee with loan>
-- =============================================
create PROCEDURE  [dbo].[SP_payslipind]
	-- Add the parameters for the stored procedure here
		@idemployee int,
		@idpayrollsum int
	
		
AS
BEGIN
	-- SET NOCOUNT ON added to prevent extra result sets from
	-- interfering with SELECT statements.
	SET NOCOUNT ON;

SELECT        payroll_summary.idpayrollsum, payroll_summary.Employee_id, payroll_summary.Date_Start, payroll_summary.Date_End, payroll_summary.payrolldate, payroll_summary.Earnings, payroll_summary.noofhourswork, 
                         payroll_summary.noofhoursworkbill, payroll_summary.noofdayswork, payroll_summary.noofdayswork2, payroll_summary.noofdaysworkecola, payroll_summary.basic, payroll_summary.basic_bill, 
                         payroll_summary.basicforsss, payroll_summary.grossprevious, payroll_summary.Regular, payroll_summary.Regular_Hours, payroll_summary.Leaves, payroll_summary.Leaves_Hours, payroll_summary.Absent, 
                         payroll_summary.Absent_Hours, payroll_summary.Tardiness, payroll_summary.Tardiness_bill, payroll_summary.Tardiness_Hours, payroll_summary.Regular2, payroll_summary.Overtime, payroll_summary.Overtime_bill, 
                         payroll_summary.Overtime_Hours, payroll_summary.SundayOT, payroll_summary.SundayOT_Hours, payroll_summary.LegalHoliday, payroll_summary.LegalHoliday_Hours, payroll_summary.LegalHoliday_bill, 
                         payroll_summary.LegalHolidayOT, payroll_summary.LegalHolidayOT_Hours, payroll_summary.LegalHolidayOT_bill, payroll_summary.LegalHolidayND, payroll_summary.LegalHolidayND_Hours, 
                         payroll_summary.LegalHolidayND_bill, payroll_summary.LHONRDOThours, payroll_summary.LHONRDOT, payroll_summary.LHONRDOT_bill, payroll_summary.HolidayND_Hours, payroll_summary.Nightdiff, 
                         payroll_summary.Nightdiff_bill, payroll_summary.Nightdiff_Hours, payroll_summary.NightdiffOT, payroll_summary.NightdiffOT_Bill, payroll_summary.NightdiffOT_Hours, payroll_summary.SHNightdiffOT, 
                         payroll_summary.SHNightdiffOT_Bill, payroll_summary.SHNightdiffOT_Hours, payroll_summary.SHONRDOThours, payroll_summary.SHONRDOT, payroll_summary.SHONRDOT_bill, payroll_summary.Holiday_Special, 
                         payroll_summary.Holiday_Special_bill, payroll_summary.Holiday_Special_Hours, payroll_summary.Holiday_SpecialOT, payroll_summary.Holiday_SpecialOT_bill, payroll_summary.Holiday_SpecialOT_Hours, 
                         payroll_summary.Holiday_SpecialND_Hours, payroll_summary.Holiday_Specialnightdiff, payroll_summary.Holiday_Specialnightdiff_bill, payroll_summary.regularnightshiftOT, payroll_summary.regularnightshiftOT_bill, 
                         payroll_summary.regularnightshiftOT_hours, payroll_summary.Premium_Pay, payroll_summary.Adjustment, payroll_summary.Adjustmentbilling, payroll_summary.Bonus, payroll_summary.Incentives, 
                         payroll_summary.OtherPay, payroll_summary.Totalsalary, payroll_summary.TotalOT, payroll_summary.grossalary, payroll_summary.Deduction, payroll_summary.contributionSSSEE, payroll_summary.contributionSSSER, 
                         payroll_summary.contributionSSSECC, payroll_summary.contributionPagibigEE, payroll_summary.contributionPagibigER, payroll_summary.contributionphilhealthEE, payroll_summary.contributionphilhealthER, 
                         payroll_summary.Wtax, payroll_summary.Other_Deduction, payroll_summary.Personal_Deduction, payroll_summary.Totaldeduction, payroll_summary.Totaldeduction_bill, payroll_summary.netamount, 
                         payroll_summary.netamount_bill, payroll_summary.dailyrate_payroll, payroll_summary.dailyrate_billing, payroll_summary.TaxStatus, payroll_summary.Factor, payroll_summary.job_code, payroll_summary.withoutd, 
                         payroll_summary.ecolaperday, payroll_summary.ecolapayroll, payroll_summary.seaperday, payroll_summary.seapayroll, payroll_summary.ctpaperday, payroll_summary.ctpapayroll, payroll_summary.regularOTrate, 
                         payroll_summary.regularOTrate_bill, payroll_summary.nightdiffrate, payroll_summary.nightdiffrate_bill, payroll_summary.legalholidayrate, payroll_summary.legalholidayrate_bill, payroll_summary.legalholidayOTrate, 
                         payroll_summary.legalholidayOTrate_bill, payroll_summary.legalholidayNDrate, payroll_summary.legalholidayNDrate_bill, payroll_summary.LHonRDOTrate, payroll_summary.LHonRDOTrate_bill, 
                         payroll_summary.specialholidayrate, payroll_summary.specialholidayrate_bill, payroll_summary.specialholidayOTrate, payroll_summary.specialholidayOTrate_bill, payroll_summary.specialholidaynightdiffrate, 
                         payroll_summary.specialholidaynightdiffrate_bill, payroll_summary.SHonRDOTrate, payroll_summary.SHonRDOTrate_bill, payroll_summary.nightdiffOTrate, payroll_summary.nightdiffOTrate_bill, 
                         payroll_summary.regularnightshiftOTrate, payroll_summary.RDhours, payroll_summary.RD, payroll_summary.RDrate, payroll_summary.RD_bill, payroll_summary.RDrate_bill, payroll_summary.WDOhours, 
                         payroll_summary.WDO, payroll_summary.WDOrate, payroll_summary.WDO_bill, payroll_summary.WDOrate_bill, payroll_summary.idclientp, payroll_summary.idclientbranchp, payroll_summary.idbranchpositionp, 
                         payroll_summary.department_codep, payroll_summary.thirteenmonth, payroll_summary.silp, payroll_summary.payrollmonth, payroll_summary.payrollmonthsort, payroll_summary.payrollpaytype, 
                         payroll_summary.payrollatmno, payroll_summary.Pagibig_Loan, payroll_summary.Salary_Loan, payroll_summary.Adjustment2, payroll_summary.pagibigloantemp, payroll_summary.basicforphil, 
                         payroll_summary.basicforphilend, payroll_summary.basicforsssend, payroll_summary.taxableadjustment, payroll_summary.grossamttaxable, payroll_summary.payrollyear, payroll_summary.jobposition2, 
                         payroll_summary.contributionSSSEEpro, payroll_summary.contributionSSSERpro, payroll_summary.ytdstart, payroll_summary.ytdend, payroll_summary.thirteenmonthyear, payroll_summary.ytdthirteenmonth, 
                         payroll_summary.postedthirteen, payroll_summary.lhotndh, payroll_summary.lhotnd, payroll_summary.lhotndrate, payroll_summary.shotndh, payroll_summary.shotnd, payroll_summary.shotndrate, 
                         payroll_summary.basicforssspro, payroll_summary.nightdifftotal, payroll_summary.netamount2, payroll_summary.other_deduction2, payroll_summary.legalnoworkhours, payroll_summary.legalnowork, 
                         payroll_summary.legalnoworkrate, payroll_summary.payrollremarks, payroll_summary.silpaid, payroll_summary.legalholiday2, payroll_summary.LegalHoliday2_Hours, payroll_summary.legalholidayrate2, 
                         payroll_summary.specialholiday2, payroll_summary.specialholiday2_hours, payroll_summary.specialholidayrate2, payroll_summary.RDot, payroll_summary.RDothours, payroll_summary.RDotrate, payroll_summary.rdnd, 
                         payroll_summary.rdndhours, payroll_summary.rdndrate, Employee.fname, Employee.lname, Employee.mname, payroll_summary.signprepared, payroll_summary.companyname2
FROM            Employee INNER JOIN
                         payroll_summary ON Employee.Employee_id = payroll_summary.Employee_id
WHERE       payroll_summary.idpayrollsum = @idpayrollsum


END
