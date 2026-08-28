-- =============================================
-- Author:		<Pat Relos>
-- Create date: <7-16-2023>
-- Description:	<Processing of Loan to Payroll>
-- =============================================
CREATE PROCEDURE [dbo].[USP_Payrollposting]	
-- Add the parameters for the stored procedure here
	
	@idpayrollsum int
	--@userpost varchar(15)
		
AS

BEGIN
	-- SET NOCOUNT ON added to prevent extra result sets from
	-- interfering with SELECT statements.
SET NOCOUNT ON;

declare @count int


 BEGIN TRY
        BEGIN TRANSACTION;

--DECLARE myCursor CURSOR FOR
   	  
--	  SELECT idpayrollsum FROM GREENHRISMAIN.dbo.payroll_summary where idclientp = 42 and payrollmonth ='December 2019'
	
--	OPEN myCursor
   
--	FETCH NEXT FROM myCursor INTO @idpayrollsum
--	WHILE @@FETCH_STATUS = 0
--	BEGIN
		
		SELECT @count =  COUNT(idpayrollsum) FROM  payrollhistory.dbo.payroll_history where idpayrollsum = @idpayrollsum 				

		if @count = 0  -- means not exist in payroll history
			Begin
	
				Print 'insert'	
				INSERT INTO payrollhistory.dbo.payroll_history
                         (idpayrollsum, Employee_id, Date_Start, Date_End, payrolldate, Earnings, noofhourswork, noofhoursworkbill, noofdayswork, noofdayswork2, noofdaysworkecola, basic, basic_bill, basicforsss, grossprevious, Regular, 
                         Regular_Hours, Leaves, Leaves_Hours, Absent, Absent_Hours, Tardiness, Tardiness_bill, Tardiness_Hours, Regular2, Overtime, Overtime_bill, Overtime_Hours, SundayOT, SundayOT_Hours, LegalHoliday, 
                         LegalHoliday_Hours, LegalHoliday_bill, LegalHolidayOT, LegalHolidayOT_Hours, LegalHolidayOT_bill, LegalHolidayND, LegalHolidayND_Hours, LegalHolidayND_bill, LHONRDOThours, LHONRDOT, LHONRDOT_bill, 
                         HolidayND_Hours, Nightdiff, Nightdiff_bill, Nightdiff_Hours, NightdiffOT, NightdiffOT_Bill, NightdiffOT_Hours, SHNightdiffOT, SHNightdiffOT_Bill, SHNightdiffOT_Hours, SHONRDOThours, SHONRDOT, SHONRDOT_bill, 
                         Holiday_Special, Holiday_Special_bill, Holiday_Special_Hours, Holiday_SpecialOT, Holiday_SpecialOT_bill, Holiday_SpecialOT_Hours, Holiday_SpecialND_Hours, Holiday_Specialnightdiff, Holiday_Specialnightdiff_bill, 
                         regularnightshiftOT, regularnightshiftOT_bill, regularnightshiftOT_hours, Premium_Pay, Adjustment, Adjustmentbilling, Bonus, Incentives, OtherPay, Totalsalary, Totalsalary_bill, TotalOT, TotalOT_bill, grossalary, 
                         grossalary_bill, Deduction, contributionSSSEE, contributionSSSER, contributionSSSECC, contributionPagibigEE, contributionPagibigER, contributionphilhealthEE, contributionphilhealthER, Wtax, Other_Deduction, 
                         Other_Deductionbilling, Personal_Deduction, Totaldeduction, Totaldeduction_bill, netamount, netamount_bill, dailyrate_payroll, dailyrate_billing, TaxStatus, Factor, job_code, withoutd, ecolaperday, ecolapayroll, seaperday, 
                         seapayroll, ctpaperday, ctpapayroll, regularOTrate, regularOTrate_bill, nightdiffrate, nightdiffrate_bill, legalholidayrate, legalholidayrate_bill, legalholidayOTrate, legalholidayOTrate_bill, legalholidayNDrate, 
                         legalholidayNDrate_bill, LHonRDOTrate, LHonRDOTrate_bill, specialholidayrate, specialholidayrate_bill, specialholidayOTrate, specialholidayOTrate_bill, specialholidaynightdiffrate, specialholidaynightdiffrate_bill, 
                         SHonRDOTrate, SHonRDOTrate_bill, nightdiffOTrate, nightdiffOTrate_bill, regularnightshiftOTrate, RDhours, RD, RDrate, RD_bill, RDrate_bill, WDOhours, WDO, WDOrate, WDO_bill, WDOrate_bill, idclientp, idclientbranchp, 
                         idbranchpositionp, department_codep, thirteenmonth, silp, payrollmonth, payrollmonthsort, payrollpaytype, payrollatmno, pcreatedby, pupdateby, pcreateddate, plastupdate, datalocked, Pagibig_Loan, Salary_Loan, Adjustment2, 
                         sssloantemp, pagibigloantemp, basicforphil, basicforsssend, basicforphilend, taxableadjustment, grossamttaxable, payrollyear, lname, fname, mname, companyname, location, branch, jobposition, departmentdesc, status, 
                         signprepared, signapproved, signnoted, logo, posted, tinno, contributionSSSEEpro, contributionSSSERpro, ytdstart, ytdend, thirteenmonthyear, ytdthirteenmonth, postedthirteen, lhotndh, lhotnd, lhotndrate, shotndh, shotnd, 
                         shotndrate, empbankname, empchequeno, empmoneyxfername, empmoneyxferno, dupstag, basicforssspro, nightdifftotal, netamount2, other_deduction2, legalnoworkhours, legalnowork, legalnoworkrate, override, 
                         payrollremarks, nodeduction, proofread, autocomputebenefits, withsss, withssspro, withphi, withpag, sssbasis, philhealthbasis, departmentidtemp, depdesctemp)

SELECT        @idpayrollsum AS idpayrollsum, Employee_id, Date_Start, Date_End, payrolldate, Earnings, noofhourswork, noofhoursworkbill, noofdayswork, noofdayswork2, noofdaysworkecola, basic, basic_bill, basicforsss, grossprevious, 
                         Regular, Regular_Hours, Leaves, Leaves_Hours, Absent, Absent_Hours, Tardiness, Tardiness_bill, Tardiness_Hours, Regular2, Overtime, Overtime_bill, Overtime_Hours, SundayOT, SundayOT_Hours, LegalHoliday, 
                         LegalHoliday_Hours, LegalHoliday_bill, LegalHolidayOT, LegalHolidayOT_Hours, LegalHolidayOT_bill, LegalHolidayND, LegalHolidayND_Hours, LegalHolidayND_bill, LHONRDOThours, LHONRDOT, LHONRDOT_bill, 
                         HolidayND_Hours, Nightdiff, Nightdiff_bill, Nightdiff_Hours, NightdiffOT, NightdiffOT_Bill, NightdiffOT_Hours, SHNightdiffOT, SHNightdiffOT_Bill, SHNightdiffOT_Hours, SHONRDOThours, SHONRDOT, SHONRDOT_bill, 
                         Holiday_Special, Holiday_Special_bill, Holiday_Special_Hours, Holiday_SpecialOT, Holiday_SpecialOT_bill, Holiday_SpecialOT_Hours, Holiday_SpecialND_Hours, Holiday_Specialnightdiff, Holiday_Specialnightdiff_bill, 
                         regularnightshiftOT, regularnightshiftOT_bill, regularnightshiftOT_hours, Premium_Pay, Adjustment, Adjustmentbilling, Bonus, Incentives, OtherPay, Totalsalary, Totalsalary_bill, TotalOT, TotalOT_bill, grossalary, 
                         grossalary_bill, Deduction, contributionSSSEE, contributionSSSER, contributionSSSECC, contributionPagibigEE, contributionPagibigER, contributionphilhealthEE, contributionphilhealthER, Wtax, Other_Deduction, 
                         Other_Deductionbilling, Personal_Deduction, Totaldeduction, Totaldeduction_bill, netamount, netamount_bill, dailyrate_payroll, dailyrate_billing, TaxStatus, Factor, job_code, withoutd, ecolaperday, ecolapayroll, seaperday, 
                         seapayroll, ctpaperday, ctpapayroll, regularOTrate, regularOTrate_bill, nightdiffrate, nightdiffrate_bill, legalholidayrate, legalholidayrate_bill, legalholidayOTrate, legalholidayOTrate_bill, legalholidayNDrate, 
                         legalholidayNDrate_bill, LHonRDOTrate, LHonRDOTrate_bill, specialholidayrate, specialholidayrate_bill, specialholidayOTrate, specialholidayOTrate_bill, specialholidaynightdiffrate, specialholidaynightdiffrate_bill, 
                         SHonRDOTrate, SHonRDOTrate_bill, nightdiffOTrate, nightdiffOTrate_bill, regularnightshiftOTrate, RDhours, RD, RDrate, RD_bill, RDrate_bill, WDOhours, WDO, WDOrate, WDO_bill, WDOrate_bill, idclientp, idclientbranchp, 
                         idbranchpositionp, department_codep, thirteenmonth, silp, payrollmonth, payrollmonthsort, payrollpaytype, payrollatmno, pcreatedby, pupdateby, pcreateddate, plastupdate, datalocked, Pagibig_Loan, Salary_Loan, Adjustment2, 
                         sssloantemp, pagibigloantemp, basicforphil, basicforsssend, basicforphilend, taxableadjustment, grossamttaxable, payrollyear, lname2, fname2, mname2, companyname2, location2, branch2, jobposition2, departmentdesc2, 
                         status2, signprepared, signapproved, signnoted, logo, posted, tinno, contributionSSSEEpro, contributionSSSERpro, ytdstart, ytdend, thirteenmonthyear, ytdthirteenmonth, postedthirteen, lhotndh, lhotnd, lhotndrate, shotndh, 
                         shotnd, shotndrate, empbankname, empchequeno, empmoneyxfername, empmoneyxferno, dupstag, basicforssspro, nightdifftotal, netamount2, other_deduction2, legalnoworkhours, legalnowork, legalnoworkrate, override, 
                         payrollremarks, nodeduction, proofread, autocomputebenefits, withsss, withssspro, withphi, withpag, sssbasis, philhealthbasis, departmentidtemp, depdesctemp
						FROM  payroll_summary
						where idpayrollsum = @idpayrollsum
						
						UPDATE payroll_summary
						SET posted= 'Yes'
                        WHERE idpayrollsum= @idpayrollsum



			End 

		else 
		begin 

			--update 

/*			
UPDATE  payrollhistory.dbo.payroll_history
SET Employee_id = payroll_summary.Employee_id
FROM payrollhistory.dbo.payroll_history INNER JOIN
payroll_summary ON payrollhistory.dbo.payroll_history.idpayrollsum = payroll_summary.idpayrollsum
WHERE   payrollhistory.dbo.payroll_history.idpayrollsum = @idpayrollsum
*/


 UPDATE  payrollhistory.dbo.payroll_history
SET Employee_id = payroll_summary.Employee_id
, Date_Start = payroll_summary.Date_Start
, Date_End = payroll_summary.Date_End
, payrolldate = payroll_summary.payrolldate
, Earnings = payroll_summary.Earnings
, noofhourswork = payroll_summary.noofhourswork
, noofhoursworkbill = payroll_summary.noofhoursworkbill
, noofdayswork = payroll_summary.noofdayswork
, noofdayswork2 = payroll_summary.noofdayswork2
, noofdaysworkecola = payroll_summary.noofdaysworkecola
, basic = payroll_summary.basic
, basic_bill =payroll_summary.basic_bill
, basicforsss = payroll_summary.basicforsss
, grossprevious = payroll_summary.grossprevious
, Regular = payroll_summary.Regular
, Regular_Hours = payroll_summary.Regular_Hours
, Leaves = payroll_summary.Leaves
, Leaves_Hours = payroll_summary.Leaves_Hours
, Absent = payroll_summary.Absent
, Absent_Hours = payroll_summary.Absent_Hours
, Tardiness = payroll_summary.Tardiness
, Tardiness_bill = payroll_summary.Tardiness_bill
, Tardiness_Hours = payroll_summary.Tardiness_Hours
, Regular2 = payroll_summary.Regular2
, Overtime = payroll_summary.Overtime
, Overtime_bill = payroll_summary.Overtime_bill
, Overtime_Hours = payroll_summary.Overtime_Hours
, SundayOT = payroll_summary.SundayOT
, SundayOT_Hours = payroll_summary.SundayOT_Hours
, LegalHoliday = payroll_summary.LegalHoliday
, LegalHoliday_Hours = payroll_summary.LegalHoliday_Hours
, LegalHoliday_bill = payroll_summary.LegalHoliday_bill
, LegalHolidayOT = payroll_summary.LegalHolidayOT
, LegalHolidayOT_Hours = payroll_summary.LegalHolidayOT_Hours
, LegalHolidayOT_bill = payroll_summary.LegalHolidayOT_bill
, LegalHolidayND = payroll_summary.LegalHolidayND
, LegalHolidayND_Hours = payroll_summary.LegalHolidayND_Hours
, LegalHolidayND_bill =  payroll_summary.LegalHolidayND_bill
, LHONRDOThours = payroll_summary.LHONRDOThours
, LHONRDOT = payroll_summary.LHONRDOT
, LHONRDOT_bill = payroll_summary.LHONRDOT
, HolidayND_Hours = payroll_summary.HolidayND_Hours
, Nightdiff = payroll_summary.Nightdiff
, Nightdiff_bill = payroll_summary.Nightdiff_bill
, Nightdiff_Hours = payroll_summary.Nightdiff_Hours
, NightdiffOT = payroll_summary.NightdiffOT
, NightdiffOT_Bill = payroll_summary.NightdiffOT_Bill
, NightdiffOT_Hours = payroll_summary.NightdiffOT_Hours
, SHNightdiffOT = payroll_summary.SHNightdiffOT
, SHNightdiffOT_Bill = payroll_summary.SHNightdiffOT_Bill
, SHNightdiffOT_Hours = payroll_summary.SHNightdiffOT_Hours
, SHONRDOThours = payroll_summary.SHONRDOThours
, SHONRDOT = payroll_summary.SHONRDOT
, SHONRDOT_bill = payroll_summary.SHONRDOT_bill
, Holiday_Special = payroll_summary.Holiday_Special
, Holiday_Special_bill = payroll_summary.Holiday_Special_bill
, Holiday_Special_Hours = payroll_summary.Holiday_Special_Hours
, Holiday_SpecialOT = payroll_summary.Holiday_SpecialOT
, Holiday_SpecialOT_bill = payroll_summary.Holiday_SpecialOT_bill
, Holiday_SpecialOT_Hours = payroll_summary.Holiday_SpecialOT_Hours
, Holiday_SpecialND_Hours = payroll_summary.Holiday_SpecialND_Hours
, Holiday_Specialnightdiff = payroll_summary.Holiday_Specialnightdiff
, Holiday_Specialnightdiff_bill = payroll_summary.Holiday_Specialnightdiff_bill
, regularnightshiftOT = payroll_summary.regularnightshiftOT
, regularnightshiftOT_bill = payroll_summary.regularnightshiftOT_bill
, regularnightshiftOT_hours = payroll_summary.regularnightshiftOT_hours
, Premium_Pay = payroll_summary.Premium_Pay
, Adjustment = payroll_summary.Adjustment
, Adjustmentbilling = payroll_summary.Adjustmentbilling
, Bonus = payroll_summary.Bonus
, Incentives = payroll_summary.Incentives
, OtherPay = payroll_summary.OtherPay
, Totalsalary = payroll_summary.Totalsalary
, Totalsalary_bill = payroll_summary.Totalsalary_bill
, TotalOT = payroll_summary.TotalOT
, TotalOT_bill = payroll_summary.TotalOT_bill
, grossalary = payroll_summary.grossalary
, grossalary_bill = payroll_summary.grossalary_bill
, Deduction = payroll_summary.Deduction
, contributionSSSEE = payroll_summary.contributionSSSEE
, contributionSSSER = payroll_summary.contributionSSSER
, contributionSSSECC = payroll_summary.contributionSSSECC
, contributionPagibigEE = payroll_summary.contributionPagibigEE
, contributionPagibigER = payroll_summary.contributionPagibigER
, contributionphilhealthEE = payroll_summary.contributionphilhealthEE
, contributionphilhealthER = payroll_summary.contributionphilhealthER
, Wtax = payroll_summary.Wtax
, Other_Deduction = payroll_summary.Other_Deduction
, Other_Deductionbilling = payroll_summary.Other_Deductionbilling
, Personal_Deduction = payroll_summary.Personal_Deduction
, Totaldeduction = payroll_summary.Totaldeduction
, Totaldeduction_bill = payroll_summary.Totaldeduction_bill
, netamount = payroll_summary.netamount
, netamount_bill = payroll_summary.netamount_bill
, dailyrate_payroll = payroll_summary.dailyrate_payroll
, dailyrate_billing = payroll_summary.dailyrate_billing
, TaxStatus = payroll_summary.TaxStatus
, Factor = payroll_summary.Factor
, job_code = payroll_summary.job_code
, withoutd = payroll_summary.withoutd
, ecolaperday = payroll_summary.ecolaperday
, ecolapayroll = payroll_summary.ecolapayroll
, seaperday = payroll_summary.seaperday
, seapayroll = payroll_summary.seapayroll
, ctpaperday = payroll_summary.ctpaperday
, ctpapayroll = payroll_summary.ctpapayroll
, regularOTrate = payroll_summary.regularOTrate
, regularOTrate_bill = payroll_summary.regularOTrate_bill
, nightdiffrate = payroll_summary.nightdiffrate
, nightdiffrate_bill = payroll_summary.nightdiffrate_bill
, legalholidayrate = payroll_summary.legalholidayrate
, legalholidayrate_bill = payroll_summary.legalholidayrate_bill
, legalholidayOTrate = payroll_summary.legalholidayOTrate
, legalholidayOTrate_bill = payroll_summary.legalholidayOTrate_bill
, legalholidayNDrate = payroll_summary.legalholidayNDrate
, legalholidayNDrate_bill = payroll_summary.legalholidayNDrate_bill
, LHonRDOTrate = payroll_summary.LHonRDOTrate
, LHonRDOTrate_bill = payroll_summary.LHonRDOTrate_bill
, specialholidayrate = payroll_summary.specialholidayrate
, specialholidayrate_bill = payroll_summary.specialholidayrate_bill
, specialholidayOTrate = payroll_summary.specialholidayOTrate
, specialholidayOTrate_bill = payroll_summary.specialholidayOTrate_bill
, specialholidaynightdiffrate = payroll_summary.specialholidaynightdiffrate
, specialholidaynightdiffrate_bill = payroll_summary.specialholidaynightdiffrate_bill
, SHonRDOTrate = payroll_summary.SHonRDOTrate
, SHonRDOTrate_bill = payroll_summary.SHonRDOTrate_bill
, nightdiffOTrate = payroll_summary.nightdiffOTrate
, nightdiffOTrate_bill = payroll_summary.nightdiffOTrate_bill
, regularnightshiftOTrate = payroll_summary.regularnightshiftOTrate
, RDhours = payroll_summary.RDhours
, RD = payroll_summary.RD, RDrate = payroll_summary.RDrate
, RD_bill = payroll_summary.RD_bill
, RDrate_bill = payroll_summary.RDrate_bill
, WDOhours = payroll_summary.WDOhours
, WDO = payroll_summary.WDO
, WDOrate = payroll_summary.WDOrate
, WDO_bill = payroll_summary.WDO_bill
, WDOrate_bill = payroll_summary.WDOrate_bill
, idclientp = payroll_summary.idclientp
, idclientbranchp = payroll_summary.idclientbranchp
, idbranchpositionp = payroll_summary.idbranchpositionp
, department_codep = payroll_summary.department_codep
, thirteenmonth = payroll_summary.thirteenmonth
, silp = payroll_summary.silp
, payrollmonth = payroll_summary.payrollmonth
, payrollmonthsort = payroll_summary.payrollmonthsort
, payrollpaytype = payroll_summary.payrollpaytype
, payrollatmno = payroll_summary.payrollatmno
, pcreatedby = payroll_summary.pcreatedby
, pupdateby = payroll_summary.pupdateby
, pcreateddate = payroll_summary.pcreateddate
, plastupdate = payroll_summary.plastupdate
, datalocked = payroll_summary.datalocked
, Pagibig_Loan = payroll_summary.Pagibig_Loan
, Salary_Loan = payroll_summary.Salary_Loan
, Adjustment2 = payroll_summary.Adjustment2
, sssloantemp = payroll_summary.sssloantemp
, pagibigloantemp = payroll_summary.pagibigloantemp
, basicforphil = payroll_summary.basicforphil
, basicforphilend = payroll_summary.basicforphilend
, basicforsssend = payroll_summary.basicforsssend
, taxableadjustment = payroll_summary.taxableadjustment
, grossamttaxable = payroll_summary.grossamttaxable
, payrollyear = payroll_summary.payrollyear
, lname = payroll_summary.lname2
, fname = payroll_summary.fname2
, mname = payroll_summary.mname2
, companyname = payroll_summary.companyname2
, location = payroll_summary.location2
, branch = payroll_summary.branch2
, jobposition = payroll_summary.jobposition2
, departmentdesc = payroll_summary.departmentdesc2
, status = payroll_summary.status2
, signprepared = payroll_summary.signprepared
, signapproved = payroll_summary.signapproved
, signnoted = payroll_summary.signnoted
, logo = payroll_summary.logo
, posted = payroll_summary.posted
, tinno = payroll_summary.tinno
, contributionSSSEEpro = payroll_summary.contributionSSSEEpro
, contributionSSSERpro = payroll_summary.contributionSSSERpro
, ytdstart = payroll_summary.ytdstart, ytdend = payroll_summary.ytdend
, thirteenmonthyear = payroll_summary.thirteenmonthyear
, ytdthirteenmonth = payroll_summary.ytdthirteenmonth
, postedthirteen = payroll_summary.postedthirteen
, lhotndh = payroll_summary.lhotndh
, lhotnd = payroll_summary.lhotnd
, lhotndrate = payroll_summary.lhotndrate
, shotndh = payroll_summary.shotndh
, shotnd = payroll_summary.shotnd
, shotndrate = payroll_summary.shotndrate
, empbankname = payroll_summary.empbankname
, empchequeno = payroll_summary.empchequeno
, empmoneyxfername = payroll_summary.empmoneyxfername
, empmoneyxferno = payroll_summary.empmoneyxferno
, dupstag = payroll_summary.dupstag
, basicforssspro = payroll_summary.basicforssspro
, nightdifftotal = payroll_summary.nightdifftotal
, netamount2 = payroll_summary.netamount2
, other_deduction2 = payroll_summary.other_deduction2
, legalnoworkhours = payroll_summary.legalnoworkhours
, legalnowork = payroll_summary.legalnowork
, legalnoworkrate = payroll_summary.legalnoworkrate
, override = payroll_summary.override
, payrollremarks = payroll_summary.payrollremarks
, nodeduction = payroll_summary.nodeduction
, proofread = payroll_summary.proofread
, autocomputebenefits = payroll_summary.autocomputebenefits
, withsss = payroll_summary.withsss
, withssspro = payroll_summary.withssspro
, withphi = payroll_summary.withphi
, withpag = payroll_summary.withphi
, sssbasis = payroll_summary.sssbasis
, philhealthbasis = payroll_summary.philhealthbasis
FROM payrollhistory.dbo.payroll_history INNER JOIN
payroll_summary ON payrollhistory.dbo.payroll_history.idpayrollsum = payroll_summary.idpayrollsum
WHERE   payrollhistory.dbo.payroll_history.idpayrollsum = @idpayrollsum


						UPDATE payroll_summary
						SET posted= 'Yes'
                        WHERE idpayrollsum= @idpayrollsum

--		print 'Update'

			END

	--	FETCH NEXT FROM myCursor INTO  @idpayrollsum
--	END
--		CLOSE myCursor
--		DEALLOCATE myCursor
	

	--select [idpayrollsum]=@idpayrollsum

   COMMIT; -- Commit the transaction
    END TRY
    BEGIN CATCH
        ROLLBACK; -- Rollback the transaction in case of error
        THROW;    -- Re-throw the error
    END CATCH;
END
