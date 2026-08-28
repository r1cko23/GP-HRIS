
-- =============================================
-- Author:		PAts Relos
-- Create date: 2023.July.04 @ 04:03
-- Description:	List of payroll summary
-- =============================================
CREATE PROCEDURE [dbo].[usp_PayrollSummary_Listclick] 
	-- Add the parameters for the stored procedure here
		@idpayrollsum INT,
		@idclientp INT, 
		@Date_Start DateTime
AS
BEGIN
	-- SET NOCOUNT ON added to prevent extra result sets from
	-- interfering with SELECT statements.
	SET NOCOUNT ON;

    -- Select statements for procedure here
	--DECLARE
	--	@idpayrollsum INT, 
	--	@idclientp INT, 
	--	@Date_Start DateTime

	--SET @idpayrollsum = 403 
	--SET @idclientp = 15 
	--SET @Date_Start = '2022-12-01'

	SELECT idpayrollsum, idclientp, Date_Start,
		employee_id, 
		dailyrate_payroll, 
		ecolapayroll, 
		seapayroll, 
		ctpapayroll, 
		regularOTrate , 
		legalholidayrate, 
		legalholidayOTrate, 
		specialholidayrate, 
		specialholidayotrate, 
		nightdiffrate, 
		nightdiffOTrate, 
		specialholidaynightdiffrate, 
		SHonRDOTrate, 
		LHonRDOTrate, 
		noofdayswork, 
		basic, 
		overtime_hours, 
		overtime, 
		legalnoworkhours, 
		legalnowork, 
		legalnoworkrate, 
		legalholiday_hours, 
		legalholiday, 
		LegalHoliday2_Hours,
		legalholiday2,
		legalholidayrate2,
		ecolaperday, 
		seaperday, 
		ctpaperday, 
		legalHolidayOT_Hours, 
		legalHolidayOT, 
		LHONRDOT, 
		LHONRDOThours, 
		Holiday_Special_Hours, 
		Holiday_Special, 
		specialholiday2_hours,
		specialholiday2,
		specialholidayrate2,
		Holiday_SpecialOT, 
		Holiday_SpecialOT_Hours, 
		Holiday_SpecialND_Hours,
		Holiday_Specialnightdiff, 
		LegalHolidayND, 
		LegalHolidayND_Hours, 
		legalholidayNDrate, 
		lhotndh,
		lhotnd,
		lhotndrate,
		
		SHONRDOT, 
		SHONRDOThours, 
		Nightdiff, 
		Nightdiff_Hours, 
		SHNightdiffOT, 
		SHNightdiffOT_Hours, 
		regularnightshiftOT, 
		regularnightshiftOT_hours, 
		regularnightshiftOTrate, 
		thirteenmonth, 
		ytdthirteenmonth, 
		thirteenmonthyear, 
		silp,
		silpytd,
		silpaid,
		totalsalary, 
		tardiness, 
		tardiness_hours, 
		grossalary, 
		grossamttaxable, 
		adjustment, 
		adjustment2, 
		contributionpagibigEE, 
		contributionpagibigER, 
		contributionSSSEE, 
		contributionSSSER, 
		contributionSSSECC, 
		contributionSSSEEpro, 
		contributionSSSERpro, 
		contributionphilhealthEE, 
		contributionphilhealthER, 
		Wtax, 
		taxstatus, 
		payrollpaytype, 
		payrollatmno, 
		totaldeduction, 
		netamount, 
		other_deduction, 
		totalot, 
		basicforsss, 
		basicforssspro, 
		basicforphil, 
		basicforphilend, 
		grossprevious, 
		
		noofhourswork,
		noofdayswork2, 
		noofdaysworkecola, 
		SHonRDOThours, 
		LHonRDOThours, 
		RDhours, 
		RD, 
		RDrate, 
		RDothours,
		RDot,
		RDotrate,
		rdndhours,
		rdnd,
		rdndrate,
		rdndothours,
		rdndot,
		rdndotrate,
		
		WDOhours, 
		WDO, 
		WDOrate, 
		
		lhotndh, 
		lhotnd, 
		lhotndrate, 
		
		shotndh, 
		shotnd, 
		shotndrate, 
		
		

		lhwdohours,
		lhwdoothours,
		lhwdondhours,
		lhwdoNDOThours,

		lhwdorate,
		lhwdootrate,
		lhwdondrate,
		lhwdoNDOTrate,

		lhwdo,
		lhwdoot,
		lhwdond,
		lhwdondot,

		shwdohours,
		shwdoothours,
		shwdondhours,
		shwdoNDOThours,

		shwdorate,
		shwdootrate,
		shwdondrate,
		shwdoNDOTrate,

		shwdo,
		shwdoot,
		shwdond,
		shwdondot,



	
	
		LHonRDOTrate,
		SHonRDOTrate,

		


		pcreateddate, 
		pcreatedby, 
		pupdateby, 
		plastupdate, 
		empbankname, 
		empchequeno, 
		empmoneyxfername, 
		empmoneyxferno, 
		nightdifftotal, 
		netamount2,
		
		

		[override], 
		nodeduction, 
		proofread, 
		payrollremarks, 
		payrollstatus,
		schedstatutory2, 
		wtaxsched2,

		other_deduction2, 
		idbranchpositionp,
		withsss,
		withssspro,
		withphi,
		withpag,
		withtax,
		fixrate,
		allowancep,
		incomeadjustmentp,
		gcashp, 
		allowancenbp,
		incomeadjustmentnbp


	FROM
		payroll_summary 
	WHERE 
		idpayrollsum = @idpayrollsum  
		--AND idclientp = @idclientp
		--AND Date_Start = @Date_Start
	ORDER BY 
		Employee_id
                    
END
