


create PROCEDURE [dbo].[42bf00bd-6230-462f-a118-a3d93166c3b9nianzversion]
		@idclient INT,
		@idDepartment INT,
		@PayrollPeriodStart Date,
		@PayrollPeriodEnd Date,
		@PayrollPayoutDate Date,
		@UserName VarChar(20),
		@Guid VarChar(100)
AS
BEGIN
	-- SET NOCOUNT ON added to prevent extra result sets from
	-- interfering with SELECT statements.
	SET NOCOUNT ON;
	
Update otherdeduction
set idpayrollsum =NULL
where idclientdeduction = @idclient and Date_Start = @PayrollPeriodStart and iddepartmentdeduction = @idDepartment

Update adjustment
set idpayrollsum =NULL
where idclientincome = @idclient and Date_Start = @PayrollPeriodStart and iddepartmentincome = @idDepartment
	
	DECLARE
		@MonthlyPagIbigEE float,
		@MonthlyPagIbigER float,
		@AppliedMonthlyPagIbig Bit,
		@GrossAmountWithNoMandatoryDeduction float

	SET @MonthlyPagIbigEE = 100
	SET @MonthlyPagIbigER = 100
	SET @GrossAmountWithNoMandatoryDeduction = 1000


	DECLARE
		@schedstatutory VarChar(20),
		@basisofsssded VarChar(5),
		@basisofphilded VarChar(5),
		@basisofsssproded VarChar(5),
		@PreviousPeriodEnd Date,
		@ytdstart Date,
		@ytdend Date,
		@thirteenmonthyear INT


	SELECT TOP 1 
		@PreviousPeriodEnd = (CASE WHEN DAY(@PayrollPeriodStart) = [Cut2Start] THEN  DATEADD(DAY, -1, @PayrollPeriodStart) ELSE '2099-12-31' END)
		,@AppliedMonthlyPagIbig = (CASE WHEN DAY(@PayrollPeriodStart) = [Cut1Start] THEN  1 ELSE 0 END)
		,@schedstatutory = schedstatutory
		,@basisofsssded = [basisofsssded]
		,@basisofphilded = [basisofphilded]
		,@basisofsssproded = [basisofsssproded]

		,@ytdstart = [ytdstart]
		,@ytdend = [ytdend]
		,@thirteenmonthyear = [thirteenmonthyear]
	FROM [hrismain].[dbo].[client]
	WHERE [idclient] = @idclient


	DECLARE 
		@StartId Int,
		@EndId Int
	SELECT TOP 1 @StartId = Id FROM AccrualExcel WHERE @Guid = @Guid ORDER BY id 
	SELECT TOP 1 @EndId = Id FROM AccrualExcel WHERE @Guid = @Guid ORDER BY id DESC


	WHILE @StartId <= @EndId
	BEGIN
		INSERT INTO [dbo].[payroll_summary]
		 (Date_Start
		,Date_End
		,payrolldate
		,idclientp
		,Employee_id
		,lname2
		,fname2
		,mname2
		,companyname2
		,location2
		,idclientbranchp
		,branch2
		,department_codep
		,departmentdesc2
		,idbranchpositionp
		,jobposition2
		,status2
		,tinno

		--### Earnings: ###############################	
		,dailyrate_payroll --> [Daily Rate:] 
		-- 104 > [No. Hours Work:] 
		,noofhourswork
		,noofdayswork
		,basic --> [Basic Salary:]

		--### Allowance: ###############################	
		,ecolaperday
		,ecolapayroll
		,seaperday
		,seapayroll
		,ctpaperday
		,ctpapayroll
		,Totalsalary --> [TOTAL SALARY: Basic + ecola + sea + ctpa]

		--### Earnings: > Overtime ####################	
		-- 10: REGULAR > [Regular Overtime:] 
		,Overtime_Hours
		,Overtime
		,regularOTrate

		-- 11: REGULAR > [Regular Nightdiff:]
		,regularnightshiftOT_hours
		,regularnightshiftOT
		,regularnightshiftOTrate

		-- 12: REGULAR > [Night Diff OT:]
		,Nightdiff_Hours
		,Nightdiff
		,nightdiffrate

		-- 12-13: LEGAL > NO WORK:
		,legalnoworkhours
		,legalnowork
		,legalnoworkrate

		-- 13: LEGAL HOLIDAY > [Legal Holiday:]
		,LegalHoliday_Hours
		,LegalHoliday
		,legalholidayrate

		-- 14: LEGAL HOLIDAY > [Legal Holiday OT:] 
		,LegalHolidayOT_Hours    
		,LegalHolidayOT
		,legalholidayOTrate

		-- 15:  LEGAL HOLIDAY > [Legal Holiday ND:]
		,LegalHolidayND_Hours
		,LegalHolidayND
		,legalholidayNDrate

		-- 16:  LEGAL HOLIDAY > [LHOTND:]
		,lhotndh
		,lhotnd
		,lhotndrate

		-- 17: SPECIAL HOLIDAY > [Special Holiday:]
		,Holiday_Special_Hours
		,Holiday_Special
		,specialholidayrate
	
		-- 18: SPECIAL HOLIDAY > [SH OT:]
		,Holiday_SpecialOT_Hours
		,Holiday_SpecialOT
		,specialholidayOTrate

		-- 19: SPECIAL HOLIDAY > [SH Night Diff:]
		,SHNightdiffOT_Hours
		,Holiday_Specialnightdiff
		,specialholidaynightdiffrate

		-- 20: SPECIAL HOLIDAY > [SHOTND:]
		,shotndh
		,shotnd
		,shotndrate
	
		-- 21: REST DAY > [Rest Day:]
		,RDhours
		,RD
		,RDrate

		-- 22: REST DAY > [LH on RD OT:]
		,LHONRDOThours
		,LHONRDOT
		,LHonRDOTrate

		-- 23: REST DAY > [SH on RD OT:]
		,SHONRDOThours
		,SHONRDOT
		,SHonRDOTrate

		-- 24: REST DAY > [Working Dayoff:]
		,WDOhours
		,WDO
		,WDOrate

		,adjustment --= 0, 
		,taxableadjustment --= 0, 
    
		-- 5 > [Late/Undertime:]
		,Tardiness_Hours
		,Tardiness

		-- [TOTAL OT:] 
		,TotalOT

		--[GROSS SALARY:] = 
		,grossalary
		,grossamttaxable
  
		--### Deductions: ###############################	
		,grossprevious	--=0,
		,basicforsss
		--### Deductions: > SSS #########################
		,contributionSSSEE
		,contributionSSSER
		,contributionSSSECC
		--### Deductions: > SSS Provident ###############
		,basicforssspro
		,contributionSSSEEpro
		,contributionSSSERpro

		--### Deductions: > PHIC ###############
		,basicforphil
		,contributionphilhealthEE
		,contributionphilhealthER

		--### Deductions: > HDMF ###############
		,[contributionPagibigEE]
		,[contributionPagibigER]

		,wtax				--= 0, 
		,taxstatus			--= '', 
		,other_deduction	--=0, 

		--### Pay Details ######################
		,payrollpaytype		--= 'ATM', 
		,empbankname		--= '', 
		,payrollatmno		--= '' 

		--### Mandatory Benefits ###############
		,thirteenmonth
		,ytdthirteenmonth    
		,ytdstart
		,ytdend
		,thirteenmonthyear
		,postedthirteen
		,payrollmonth
		,payrollmonthsort
		,datalocked
		,payrollyear
		,posted
		,pcreatedby
		,pcreateddate
		,dupstag
		,withsss
		,withphi
		,withpag
		,autocomputebenefits)
		
		SELECT pscalc.*
		FROM
		(SELECT
			Date_Start
			,Date_End
			,payrolldate
			,idclientp
			,Employee_id
			,lname2
			,fname2
			,mname2
			,companyname2
			,location2
			,idclientbranchp
			,branch2
			,department_codep
			,departmentdesc2
			,idbranchpositionp
			,jobposition2
			,status2
			,tinno

			--### Earnings: ###############################	
			,dailyrate_payroll --> [Daily Rate:] 
			-- 104 > [No. Hours Work:] 
			,noofhourswork
			,noofdayswork
			,basic --> [Basic Salary:]
	
			--### Allowance: ###############################	
			,ecolaperday = 0
			,ecolapayroll  = 0
			,seaperday = 0
			,seapayroll = 0
			,ctpaperday = 0
			,ctpapayroll = 0
			,Totalsalary --> [TOTAL SALARY: Basic + ecola + sea + ctpa]

			--### Earnings: > Overtime ####################	
			-- 10: REGULAR > [Regular Overtime:] 
			,Overtime_Hours
			,Overtime
			,regularOTrate

			-- 11: REGULAR > [Regular Nightdiff:]
			,regularnightshiftOT_hours
			,regularnightshiftOT
			,regularnightshiftOTrate

			-- 12: REGULAR > [Night Diff OT:]
			,Nightdiff_Hours
			,Nightdiff
			,nightdiffrate

			-- 12-13: LEGAL > NO WORK:
			,legalnoworkhours
			,legalnowork
			,legalnoworkrate

			-- 13: LEGAL HOLIDAY > [Legal Holiday:]
			,LegalHoliday_Hours
			,LegalHoliday
			,legalholidayrate

			-- 14: LEGAL HOLIDAY > [Legal Holiday OT:] 
			,LegalHolidayOT_Hours    
			,LegalHolidayOT
			,legalholidayOTrate

			-- 15:  LEGAL HOLIDAY > [Legal Holiday ND:]
			,LegalHolidayND_Hours
			,LegalHolidayND
			,legalholidayNDrate

			-- 16:  LEGAL HOLIDAY > [LHOTND:]
			,lhotndh
			,lhotnd
			,lhotndrate

			-- 17: SPECIAL HOLIDAY > [Special Holiday:]
			,Holiday_Special_Hours
			,Holiday_Special
			,specialholidayrate
	
			-- 18: SPECIAL HOLIDAY > [SH OT:]
			,Holiday_SpecialOT_Hours
			,Holiday_SpecialOT
			,specialholidayOTrate

			-- 19: SPECIAL HOLIDAY > [SH Night Diff:]
			,SHNightdiffOT_Hours
			,Holiday_Specialnightdiff
			,specialholidaynightdiffrate

			-- 20: SPECIAL HOLIDAY > [SHOTND:]
			,shotndh
			,shotnd
			,shotndrate
	
			-- 21: REST DAY > [Rest Day:]
			,RDhours
			,RD
			,RDrate

			-- 22: REST DAY > [LH on RD OT:]
			,LHONRDOThours
			,LHONRDOT
			,LHonRDOTrate

			-- 23: REST DAY > [SH on RD OT:]
			,SHONRDOThours
			,SHONRDOT
			,SHonRDOTrate

			-- 24: REST DAY > [Working Dayoff:]
			,WDOhours
			,WDO
			,WDOrate

			,[adjustment] = 0 
			,[taxableadjustment] = 0
    
			-- 5 > [Late/Undertime:]
			,Tardiness_Hours
			,Tardiness

			-- [TOTAL OT:] 
			,TotalOT

			--[GROSS SALARY:] = 
			,[grossalary] =0
			,[grossamttaxable] =0

			--### Deductions: ###############################	
			,[grossprevious] =0
			,[basicforsss] =  ISNULL(ps1.[PreviousBasicforsss], 0)
			--### Deductions: > SSS #########################
			,contributionSSSEE =ISNULL(sssamt,0)
			,contributionSSSER =0
			,contributionSSSECC =0
			--### Deductions: > SSS Provident ###############
			
			,[basicforssspro] = 0
			,[contributionSSSEEpro] =0
			,[contributionSSSERpro] =0
			--### Deductions: > PHIC ###############!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!
			,[basicforphil] = ISNULL(ps1.PreviousBasicforphil, 0)
			,[contributionphilhealthEE] =ISNULL([philhealthamt],0)	
			,[contributionphilhealthER] =ISNULL([philhealthamt],0)
			--### Deductions: > HDMF ###############
			,[contributionPagibigEE] =ISNULL([pagibigamt],0)
			,[contributionPagibigER] =ISNULL([pagibigamt],0)
			,wtax = 0 
			,taxstatus = '' 
			,other_deduction = 0 
	
			--### Pay Details ######################
			,payrollpaytype
			,empbankname 
			,payrollatmno

			--### Mandatory Benefits ###############
			,thirteenmonth = basic / 12 
			,ytdthirteenmonth = 0
			,ytdstart
			,ytdend
			,thirteenmonthyear
			,postedthirteen = 'No'

			,payrollmonth
			,payrollmonthsort
			,datalocked
			,payrollyear
			,posted
			,pcreatedby
			,pcreateddate
			,dupstag
			,withsss
			,withphi
			,withpag
			,autocomputebenefits
			
			FROM
			(SELECT
				[TotalOT] = ISNULL([Overtime] + [regularnightshiftOT] + [Nightdiff] + [LegalHoliday] + [LegalHolidayOT] + [LegalHolidayND] + [lhotnd] + [Holiday_Special] + [Holiday_SpecialOT] + [Holiday_Specialnightdiff] + [shotnd] + [RD] + [LHONRDOT] + [SHONRDOT] + [WDO], 0)
				,[grossalary] = -1
				,pps.[PreviousBasicforsss]
				,pps.[PreviousContributionSSSEE] 
				,pps.[PreviousBasicforphil]
				,ps.* 
			
			FROM (SELECT 
					[Id]
					,[Employee_id] = [EmployeeId] 

					,[Date_Start] = @PayrollPeriodStart
					,[Date_End] = @PayrollPeriodEnd
					,[PayrollDate] = @PayrollPayoutDate

					,[dailyrate_payroll] = ISNULL([Rate_Daily], 0)
					,[Rate_Hourly] = ISNULL([Rate_Daily], 0)/8 
					,[basic] =[Regular_Days] * ISNULL([Rate_Daily], 0) --pat change the formula  [Regular_Hours] * [Rate_Hourly]
					,[Totalsalary] = [Regular_Days] * ISNULL([Rate_Daily], 0)
					,noofhourswork = [Regular_Hours]
					,noofdayswork = [Regular_Days] 

					-- 10: REGULAR > [Regular Overtime:] 
					,[Overtime_Hours] = [Regular_OT]
					,[Overtime] = [Rate_Hourly] * [Regular_OT] * cbp.regularOTrate
					,[regularOTrate] = cbp.regularOTrate

					-- 11: REGULAR > [Regular Nightdiff:]
					,[regularnightshiftOT_hours] = [Regular_ND]
					,[regularnightshiftOT] = [Rate_Hourly] * [Regular_ND] * cbp.regularnightdiffOTrate
					,[regularnightshiftOTrate] = cbp.regularnightdiffOTrate

					-- 12: REGULAR > [Night Diff OT:]
					,[Nightdiff_Hours] = [Regular_NDOT]
					,[Nightdiff] = [Rate_Hourly] * [Regular_NDOT] * cbp.nightdiffrate
					,[nightdiffrate] = cbp.nightdiffrate

					--12.13 LEGAL > NO WORK
					,[legalnoworkhours] = [Legal_NoWork_Hours]  
					,[legalnowork] = [Rate_Hourly] * [Legal_NoWork_Hours] * cbp.legalnoworkrate 
					,[legalnoworkrate] = cbp.legalnoworkrate

					-- 13: LEGAL HOLIDAY > [Legal Holiday:]
					,[LegalHoliday_Hours] = [LegalHoliday_Hours]
					,[LegalHoliday] = [Rate_Hourly] * [LegalHoliday_Hours] * cbp.legalholidayrate
					,[legalholidayrate] = cbp.legalholidayrate

					-- 14: LEGAL HOLIDAY > [Legal Holiday OT:] 
					,[LegalHolidayOT_Hours] = [LegalHoliday_OT]   
					,[LegalHolidayOT] = [Rate_Hourly] * [LegalHoliday_OT] * cbp.legalholidayOTrate  
					,[legalholidayOTrate] = cbp.legalholidayOTrate 

					-- 15:  LEGAL HOLIDAY > [Legal Holiday ND:]
					,[LegalHolidayND_Hours] = [LegalHoliday_ND]
					,[LegalHolidayND] = [Rate_Hourly] * [LegalHoliday_ND] * cbp.legalholidayNDrate
					,[legalholidayNDrate] = cbp.legalholidayNDrate

					-- 16:  LEGAL HOLIDAY > [LHOTND:]
					,[lhotndh] = [LegalHoliday_NDOT]
					,[lhotnd] = [Rate_Hourly] * [LegalHoliday_NDOT] * cbp.lhotndrate
					,[lhotndrate] = cbp.lhotndrate

					-- 17: SPECIAL HOLIDAY > [Special Holiday:]
					,[Holiday_Special_Hours] = [SpecialHoliday_Hours]
					,[Holiday_Special] = [Rate_Hourly] * [SpecialHoliday_Hours] * cbp.specialholidayrate
					,[specialholidayrate] = cbp.specialholidayrate

					-- 18: SPECIAL HOLIDAY > [SH OT:]
					,[Holiday_SpecialOT_Hours] = [SpecialHoliday_OT]
					,[Holiday_SpecialOT] = [Rate_Hourly] * [SpecialHoliday_OT] * cbp.specialholidayotrate
					,[specialholidayOTrate] = cbp.specialholidayotrate

					-- 19: SPECIAL HOLIDAY > [SH Night Diff:]
					,[SHNightdiffOT_Hours] = [SpecialHoliday_ND]
					,[Holiday_Specialnightdiff] = [Rate_Hourly] * [SpecialHoliday_ND] * cbp.specialholidaynightdiffrate 
					,[specialholidaynightdiffrate] = cbp.specialholidaynightdiffrate

					-- 20: SPECIAL HOLIDAY > [SHOTND:]
					,[shotndh] = [SpecialHoliday_NDOT]
					,[shotnd] = [Rate_Hourly] * [SpecialHoliday_NDOT] * cbp.shotndrate 
					,[shotndrate] = cbp.shotndrate

					-- 21: REST DAY > [Rest Day:]
					,[RDhours] = [RestDay_Hours]
					,[RD] = [Rate_Hourly] * [RestDay_Hours] * cbp.RDrate
					,[RDrate] = cbp.RDrate

					-- 22: REST DAY > [LH on RD OT:]
					,[LHONRDOThours] = [RestDay_Hours_LH_OT]
					,[LHONRDOT] = [Rate_Hourly] * [RestDay_Hours_LH_OT] * cbp.LHonRDOT
					,[LHonRDOTrate] = cbp.LHonRDOT

					-- 23: REST DAY > [SH on RD OT:]
					,[SHONRDOThours] = [RestDay_Hours_SH_OT]
					,[SHONRDOT] = [Rate_Hourly] * [RestDay_Hours_SH_OT] * cbp.SHonRDOT
					,[SHonRDOTrate] = cbp.SHonRDOT

					-- 24: REST DAY > [Working Dayoff:]
					,[WDOhours] = [RestDay_Hours_WDO]
					,[WDO] = [Rate_Hourly] * [RestDay_Hours_WDO] * cbp.wdorate
					,[WDOrate] = cbp.wdorate

					-- 5 > [Late/Undertime:]
					,[Tardiness_Hours] = [Late_UT_Hours]
					,[Tardiness] = ISNULL(([Late_UT_Hours]/60) * [Rate_Hourly], 0)

					,[idclientp] = ae.[idClient]
					,[idclientbranchp] = cbp.idclientbranch
					,[idbranchpositionp] = cbp.idbranchposition
					,[department_codep] = ae.idDepartment

					,[payrollmonth] = FORMAT(@PayrollPayoutDate, 'MMMM yyyy', 'en-US')    	
					,[payrollmonthsort] = FORMAT(@PayrollPayoutDate, 'yyyyMM', 'en-US')
					,[pcreatedby] = @UserName
					,[pcreateddate] = GETDATE()
					,[datalocked] = 'No'
					,[payrollyear] = FORMAT(@PayrollPayoutDate, 'yyyy', 'en-US')
					,[lname2] = e.lname 
					,[fname2] = e.fname
					,[mname2] = e.mname
					,[companyname2] = ae.[ClientName]
					,[location2] = cb.location
					,[branch2] = cb.branch
					,[jobposition2] = [Position]
					,[departmentdesc2] = DepartmentDesc 
					,[status2] = e.status
					,[posted] = 'No'
					,[tinno] = e.TINno
					,[payrollpaytype] = ae.paytype
					,[empbankname] = e.bankname  
					,[payrollatmno] = ae.payrollatmno -- e.bankaccountno 
					,[ytdstart] = @ytdstart
					,[ytdend] = @ytdend
					,[thirteenmonthyear] = @thirteenmonthyear
					,[dupstag] = ae.DupsTag
					,[withsss] = ae.withsss
					,[withphi] = ae.withphi
					,[withpag] = ae.withpag
					,[autocomputebenefits] =  ae.autocomputebenefits
					,[sssamt] = ae.sssamt
					,[philhealthamt] = ae.philhealthamt
					,[pagibigamt] = ae.pagibigamt
					
					FROM 
					[hrismain].[dbo].[AccrualExcel] ae
					INNER JOIN Employee e ON e.Employee_id = ae.EmployeeId
					INNER JOIN client_branch_position cbp ON cbp.jobposition = ae.Position AND cbp.idclient = ae.idClient
					INNER JOIN client_branch cb ON cb.idclient = ae.idClient 
				WHERE 
					ae.Id = @StartId
					AND ae.Guid = @Guid
					AND ae.[idClient] = @idclient
					AND e.tagdelete = 'N'
					AND ae.idDepartment = @idDepartment
					AND ae.PayrollPeriodStart = @PayrollPeriodStart 
					AND ae.PayrollPeriodEnd = @PayrollPeriodEnd 
					AND ae.PayrollDate = @PayrollPayoutDate) ps
				LEFT JOIN (	SELECT
								Employee_id
								,[PreviousBasicforsss] = SUM((CASE WHEN @schedstatutory = 'Semi-Monthly' THEN (CASE WHEN @basisofsssded = 'basic' THEN [basic] ELSE [grossalary] END) ELSE 0 END)) 
								,[PreviousContributionSSSEE] = SUM(contributionSSSEE)
								,[PreviousContributionSSSER] = SUM(contributionSSSER)
								,[PreviousContributionSSSECC] = SUM(contributionSSSECC)
								,[PreviousBasicforssspro] = SUM(ISNULL((CASE WHEN @schedstatutory = 'Semi-Monthly' THEN (CASE WHEN @basisofsssproded = 'basic' THEN [basic] ELSE [grossalary] END) ELSE 0 END), 0)) 
								,[PreviousContributionSSSEEpro] = SUM([contributionSSSEEpro])
								,[PreviousContributionSSSERpro] = SUM([contributionSSSERpro])
								,[PreviousBasicforphil] = SUM(ISNULL((CASE WHEN @schedstatutory = 'Semi-Monthly' THEN (CASE WHEN @basisofphilded = 'basic' THEN [basic] ELSE [grossalary] END) ELSE 0 END), 0)) 
								,[PreviousContributionphilhealthEE] = SUM([contributionphilhealthEE])
								,[PreviousContributionphilhealthER] = SUM([contributionphilhealthER])
								,[PreviousContributionPagibigEE] = SUM([contributionPagibigEE])
								,[PreviousContributionPagibigER] = SUM([contributionPagibigER])
							
							FROM 
								[hrismain].[dbo].[payroll_summary]
							WHERE 
								([Date_End] = @PreviousPeriodEnd OR [Date_Start] = @PayrollPeriodStart)
							GROUP BY Employee_id) pps ON pps.Employee_id = ps.Employee_id 
			) as ps1) as pscalc	

		SET @StartId = @StartId + 1;
			
	END
	
	-- Clean it up:	
	--DELETE FROM [hrismain].[dbo].[AccrualExcel] 
	--WHERE
	--	idClient = @idclient 
	--	AND Guid = @guid
	--	AND idDepartment = @idDepartment
	--	AND PayrollPeriodStart = @PayrollPeriodStart
	--	AND PayrollPeriodEnd = @PayrollPeriodEnd
	--	AND PayrollDate = @PayrollPayoutDate
	   
	
END

	


