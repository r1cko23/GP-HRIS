
CREATE PROCEDURE [dbo].[42bf00bd-6230-462f-a118-a3d93166c3b9V230]

@idclient INT,
@idDepartment INT,
@PayrollPeriodStart Date,
@PayrollPeriodEnd Date,
@PayrollPayoutDate Date,
@UserName VarChar(20),
@Guid VarChar(100),
@idclientbranch INT,
@payrollmonth varchar(20),
@payrollmonthsort int


AS
BEGIN

INSERT INTO payroll_summary
(Date_Start	--1
 ,Date_End		--2	
 ,payrolldate	--3	
 ,idclientp		--4
 ,Employee_id	--5
 ,lname2		--6
 ,fname2		--7
 ,mname2		--8
 ,companyname2	--9
 ,location2		--10
 ,idclientbranchp --11
 ,branch2			--12
 ,department_codep	--13
 ,departmentdesc2	--14
 ,idbranchpositionp --15
 ,jobposition2		--16
 ,status2			--17
 ,tinno				--18
 --### Earnings: ###############################	
,dailyrate_payroll --> [Daily Rate:]  --19
-- 104 > [No. Hours Work:] 
,noofhourswork			--20
,noofdayswork			--21
,basic --> [Basic Salary:] --22
,Totalsalary --> [TOTAL SALARY: Basic + ecola + sea + ctpa] 23
--### Earnings: > Overtime ####################	
-- 10: REGULAR > [Regular Overtime:] 
,Overtime_Hours				--24
,Overtime					--25
,regularOTrate				--26

-- 11: REGULAR > [Regular Nightdiff:]
,regularnightshiftOT_hours		--27
,regularnightshiftOT			--28
,regularnightshiftOTrate		--29

-- 12: REGULAR > [Night Diff OT:]
,Nightdiff_Hours
,Nightdiff
,nightdiffrate

-- 12.13: LEGAL > NO WORK:
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

-- 25 > [Late/Undertime:]
,Tardiness_Hours
,Tardiness
,payrollmonth -- 25.2
,payrollmonthsort --25.3

-- 26[TOTAL OT: AND NIGHT DIFF] 
,TotalOT
-- 27[TOTALNIGHT DIFF] 
,nightdifftotal

-- 28[Gross amount] 
,grossalary
-- 28[Gross taxable] 
,grossamttaxable

--29### Pay Details ######################
,payrollpaytype		--= 'ATM', 
,empbankname		--= '', 
,payrollatmno		--= '' 
,sssbasis
,philhealthbasis


 )
 --------------------------------------------- Vulues Insert to Payroll Summary--------------------------------
SELECT 
@PayrollPeriodStart as dstart	--1
,@PayrollPeriodEnd as dend 	    --2
,@PayrollPayoutDate as pdate	--3
,@idclient as idclient			--4
,EmployeeId						--5		
,e.lname						--6
,e.fname						--7
,e.mname						--8
,ae.ClientName					--8
,cb.location					--10
,cb.idclientbranch				--11
,cb.branch						--12
,@idDepartment as iddepart		--13
,ae.DepartmentDesc				--14
,cbp.idbranchposition			--15
,ae.Position					--16
,e.status						--17
,e.TINno						--18
,ae.Rate_Daily					--19
,ae.Regular_Hours				--20
,ae.Regular_Days				--21
,[Regular_Days] * ISNULL([Rate_Daily], 0)  --22
,[Regular_Days] * ISNULL([Rate_Daily], 0)  --23

,[Regular_OT]										--24
,[Rate_Hourly] * [Regular_OT] * cbp.regularOTrate	--25
,cbp.regularOTrate									--26

-- 11: REGULAR > [Regular Nightdiff:]						
,[Regular_ND]												--27
,[Rate_Hourly] * [Regular_ND] * cbp.regularnightdiffOTrate	--28
,cbp.regularnightdiffOTrate									--29

-- 12: REGULAR > [Night Diff OT:]
,[Regular_NDOT]
,[Rate_Hourly] * [Regular_NDOT] * cbp.nightdiffrate
,cbp.nightdiffrate

--12.13 LEGAL > NO WORK
,[Legal_NoWork_Hours]  
,[Rate_Hourly] * [Legal_NoWork_Hours] * cbp.legalnoworkrate 
,cbp.legalnoworkrate

-- 13: LEGAL HOLIDAY > [Legal Holiday:]
,[LegalHoliday_Hours]
,[Rate_Hourly] * [LegalHoliday_Hours] * cbp.legalholidayrate
,cbp.legalholidayrate

-- 14: LEGAL HOLIDAY > [Legal Holiday OT:] 
,[LegalHoliday_OT]   
,[Rate_Hourly] * [LegalHoliday_OT] * cbp.legalholidayOTrate  
,cbp.legalholidayOTrate 

-- 15:  LEGAL HOLIDAY > [Legal Holiday ND:]
,[LegalHoliday_ND]
,[Rate_Hourly] * [LegalHoliday_ND] * cbp.legalholidayNDrate
,cbp.legalholidayNDrate

-- 16:  LEGAL HOLIDAY > [LHOTND:]
,[LegalHoliday_NDOT]
,[Rate_Hourly] * [LegalHoliday_NDOT] * cbp.lhotndrate
,cbp.lhotndrate

-- 17: SPECIAL HOLIDAY > [Special Holiday:]
,[SpecialHoliday_Hours]
,[Rate_Hourly] * [SpecialHoliday_Hours] * cbp.specialholidayrate
,cbp.specialholidayrate

-- 18: SPECIAL HOLIDAY > [SH OT:]
,[SpecialHoliday_OT]
,[Rate_Hourly] * [SpecialHoliday_OT] * cbp.specialholidayotrate
,cbp.specialholidayotrate

-- 19: SPECIAL HOLIDAY > [SH Night Diff:]
,[SpecialHoliday_ND]
,[Rate_Hourly] * [SpecialHoliday_ND] * cbp.specialholidaynightdiffrate 
,cbp.specialholidaynightdiffrate

-- 20: SPECIAL HOLIDAY > [SHOTND:]
,[SpecialHoliday_NDOT]
,[Rate_Hourly] * [SpecialHoliday_NDOT] * cbp.shotndrate 
,cbp.shotndrate

-- 21: REST DAY > [Rest Day:]
,[RestDay_Hours]
,[Rate_Hourly] * [RestDay_Hours] * cbp.RDrate
,cbp.RDrate

-- 22: REST DAY > [LH on RD OT:]
,[RestDay_Hours_LH_OT]
,[Rate_Hourly] * [RestDay_Hours_LH_OT] * cbp.LHonRDOT
,cbp.LHonRDOT

-- 23: REST DAY > [SH on RD OT:]
,[RestDay_Hours_SH_OT]
,[Rate_Hourly] * [RestDay_Hours_SH_OT] * cbp.SHonRDOT
,cbp.SHonRDOT

-- 24: wdo > [Working Dayoff:]
,[RestDay_Hours_WDO]
,[Rate_Hourly] * [RestDay_Hours_WDO] * cbp.wdorate
,cbp.wdorate

-- 25 > [Late/Undertime:]
,[Late_UT_Hours]
,ISNULL(([Late_UT_Hours]/60) * [Rate_Hourly], 0)
,@payrollmonth --25.2
,@payrollmonthsort --25.3

-- 26 > [TOTAL OT]
,([Rate_Hourly] * [Regular_OT] * cbp.regularOTrate)+				--1 REGULAR OVERTIME
([Rate_Hourly] * [Regular_NDOT] * cbp.nightdiffrate)+				--2 REGULAT NIGHT DIFFF
([Rate_Hourly] * [Legal_NoWork_Hours] * cbp.legalnoworkrate)+		--3 LEGAL NO WORK
([Rate_Hourly] * [LegalHoliday_Hours] * cbp.legalholidayrate)+		--4 LEGAL HOLIDAY
([Rate_Hourly] * [LegalHoliday_OT] * cbp.legalholidayOTrate)+		--5 LEGAL HOLIDAY OT
([Rate_Hourly] * [LegalHoliday_NDOT] * cbp.lhotndrate)+				--6 LEGAL HOLIDAY NDOT 
([Rate_Hourly] * [SpecialHoliday_Hours] * cbp.specialholidayrate)+	--7 SPECIAL HOLIDAY
([Rate_Hourly] * [SpecialHoliday_OT] * cbp.specialholidayotrate)+	--8 SPECIAL HOLIDAY OT
([Rate_Hourly] * [SpecialHoliday_NDOT] * cbp.shotndrate)+			--9 SHONDOT
([Rate_Hourly] * [RestDay_Hours] * cbp.RDrate)+						--10 Rest day
([Rate_Hourly] * [RestDay_Hours_LH_OT] * cbp.LHonRDOT)+				--11 lEGAL HOLIDAY ON REST DAY OT
([Rate_Hourly] * [RestDay_Hours_SH_OT] * cbp.SHonRDOT)+				--12 SPECIAL HOLIDAY ON REST DAY OT
([Rate_Hourly] * [RestDay_Hours_WDO] * cbp.wdorate)					--13 WORKING DAYOFF

-- 27> [TOTAL NIGHT DIFF]
,([Rate_Hourly] * [Regular_ND] * cbp.regularnightdiffOTrate)+			--1. regular nighdiff OT
([Rate_Hourly] * [LegalHoliday_ND] * cbp.legalholidayNDrate)+			--2. LEGAL HOLIDAY ND
([Rate_Hourly] * [SpecialHoliday_ND] * cbp.specialholidaynightdiffrate)	--3. SPECIAL HOLIDAY ND

---- 28> [Gross Amount] 
-- Total Salary+[TOTAL OT]+
,([Regular_Days] * ISNULL([Rate_Daily], 0))+					-- Total salary
([Rate_Hourly] * [Regular_OT] * cbp.regularOTrate)+				--1 REGULAR OVERTIME
([Rate_Hourly] * [Regular_NDOT] * cbp.nightdiffrate)+				--2 REGULAT NIGHT DIFFF
([Rate_Hourly] * [Legal_NoWork_Hours] * cbp.legalnoworkrate)+		--3 LEGAL NO WORK
([Rate_Hourly] * [LegalHoliday_Hours] * cbp.legalholidayrate)+		--4 LEGAL HOLIDAY
([Rate_Hourly] * [LegalHoliday_OT] * cbp.legalholidayOTrate)+		--5 LEGAL HOLIDAY OT
([Rate_Hourly] * [LegalHoliday_NDOT] * cbp.lhotndrate)+				--6 LEGAL HOLIDAY NDOT 
([Rate_Hourly] * [SpecialHoliday_Hours] * cbp.specialholidayrate)+	--7 SPECIAL HOLIDAY
([Rate_Hourly] * [SpecialHoliday_OT] * cbp.specialholidayotrate)+	--8 SPECIAL HOLIDAY OT
([Rate_Hourly] * [SpecialHoliday_NDOT] * cbp.shotndrate)+			--9 SHONDOT
([Rate_Hourly] * [RestDay_Hours] * cbp.RDrate)+						--10 Rest day
([Rate_Hourly] * [RestDay_Hours_LH_OT] * cbp.LHonRDOT)+				--11 lEGAL HOLIDAY ON REST DAY OT
([Rate_Hourly] * [RestDay_Hours_SH_OT] * cbp.SHonRDOT)+				--12 SPECIAL HOLIDAY ON REST DAY OT
([Rate_Hourly] * [RestDay_Hours_WDO] * cbp.wdorate)+					--13 WORKING DAYOFF
-- [TOTAL NIGHT DIFF]+
([Rate_Hourly] * [Regular_ND] * cbp.regularnightdiffOTrate)+			--1. regular nighdiff OT
([Rate_Hourly] * [LegalHoliday_ND] * cbp.legalholidayNDrate)+			--2. LEGAL HOLIDAY ND
([Rate_Hourly] * [SpecialHoliday_ND] * cbp.specialholidaynightdiffrate)-	--3. SPECIAL HOLIDAY ND
ISNULL(([Late_UT_Hours]/60) * [Rate_Hourly], 0)	

---- 29> [Gross Amount Taxable] 
-- Total Salary+[TOTAL OT]+
,([Regular_Days] * ISNULL([Rate_Daily], 0))+						-- Total Salary
([Rate_Hourly] * [Regular_OT] * cbp.regularOTrate)+				--1 REGULAR OVERTIME
([Rate_Hourly] * [Regular_NDOT] * cbp.nightdiffrate)+				--2 REGULAT NIGHT DIFFF
([Rate_Hourly] * [Legal_NoWork_Hours] * cbp.legalnoworkrate)+		--3 LEGAL NO WORK
([Rate_Hourly] * [LegalHoliday_Hours] * cbp.legalholidayrate)+		--4 LEGAL HOLIDAY
([Rate_Hourly] * [LegalHoliday_OT] * cbp.legalholidayOTrate)+		--5 LEGAL HOLIDAY OT
([Rate_Hourly] * [LegalHoliday_NDOT] * cbp.lhotndrate)+				--6 LEGAL HOLIDAY NDOT 
([Rate_Hourly] * [SpecialHoliday_Hours] * cbp.specialholidayrate)+	--7 SPECIAL HOLIDAY
([Rate_Hourly] * [SpecialHoliday_OT] * cbp.specialholidayotrate)+	--8 SPECIAL HOLIDAY OT
([Rate_Hourly] * [SpecialHoliday_NDOT] * cbp.shotndrate)+			--9 SHONDOT
([Rate_Hourly] * [RestDay_Hours] * cbp.RDrate)+						--10 Rest day
([Rate_Hourly] * [RestDay_Hours_LH_OT] * cbp.LHonRDOT)+				--11 lEGAL HOLIDAY ON REST DAY OT
([Rate_Hourly] * [RestDay_Hours_SH_OT] * cbp.SHonRDOT)+				--12 SPECIAL HOLIDAY ON REST DAY OT
([Rate_Hourly] * [RestDay_Hours_WDO] * cbp.wdorate)+					--13 WORKING DAYOFF
-- [TOTAL NIGHT DIFF]+
([Rate_Hourly] * [Regular_ND] * cbp.regularnightdiffOTrate)+			--1. regular nighdiff OT
([Rate_Hourly] * [LegalHoliday_ND] * cbp.legalholidayNDrate)+			--2. LEGAL HOLIDAY ND
([Rate_Hourly] * [SpecialHoliday_ND] * cbp.specialholidaynightdiffrate)-	--3. SPECIAL HOLIDAY ND
ISNULL(([Late_UT_Hours]/60) * [Rate_Hourly], 0)	
--### Pay Details ######################
,ae.paytype
,ae.bankname
,ae.payrollatmno
,C.basisofsssded
,c.basisofphilded


FROM 
[hrismain].[dbo].[AccrualExcel] ae
INNER JOIN Employee e ON e.Employee_id = ae.EmployeeId
INNER JOIN client_branch_position cbp ON cbp.jobposition = ae.Position AND cbp.idclient = ae.idClient
INNER JOIN client_branch cb ON cb.idclient = ae.idClient 
INNER JOIN client AS C ON ae.idClient = C.idclient

WHERE 
ae.[idClient] = @idclient
AND e.tagdelete = 'N'
AND ae.idDepartment = @idDepartment
AND ae.PayrollPeriodStart = @PayrollPeriodStart
AND cb.idclientbranch = @idclientbranch

---- end  inserting data

----------------------------------------- RUN OTHER ADJUSTMENT HERE and Re-update gross amount
Declare @idemployee int
Declare @amount varchar(20)
DECLARE @ConcatenatedValue VARCHAR(MAX)
DECLARE @idpayrollsum varchar(20)
DECLARE @sqladjustmentupdate Nvarchar(max)
declare @sqladjustmentupdatepayrollsum Nvarchar(max)
DECLARE @idadjustment varchar(20)
DECLARE @totalamount varchar(20)
DECLARE @totalamount2 varchar(20)
DECLARE @totalsalary varchar(20)
DECLARE @totalOT varchar(20)
DECLARE @totalND varchar(20)
DECLARE @totalgross varchar(20)
DECLARE @tardiness varchar(20)

DECLARE myCursor CURSOR FOR
     
	SELECT employee_id,idadjustment FROM adjustment where idclientincome = @idclient and Date_Start= @PayrollPeriodStart  and iddepartmentincome = @idDepartment order by idadjustment
	  
	OPEN myCursor
   
	FETCH NEXT FROM myCursor INTO @idemployee,@idadjustment
	WHILE @@FETCH_STATUS = 0
	BEGIN
	  --- get the max idpayroll
	  SELECT TOP 1  @idpayrollsum =  idpayrollsum FROM payroll_summary where Employee_id = @idemployee and idclientp = @idclient and Date_Start= @PayrollPeriodStart  and department_codep = @idDepartment order by grossalary desc
	  	   
		   --update adjustment table idpayrollsum system assure that high gross amt should be place 
			SET @sqladjustmentupdate = ('UPDATE adjustment SET idpayrollsum=' + @idpayrollsum + ' WHERE idadjustment='+ @idadjustment + '')
			execute(@sqladjustmentupdate)

			--totalamount  adjusment
			SELECT @totalamount= COALESCE(Sum(amount),0) from adjustment WHERE idpayrollsum = @idpayrollsum 
			SELECT @totalamount2= COALESCE(Sum(amounttaxable),0) from adjustment WHERE idpayrollsum = @idpayrollsum 

			SELECT @totalsalary= COALESCE(totalsalary,0) from payroll_summary WHERE idpayrollsum = @idpayrollsum
			SELECT @totalND= COALESCE(nightdifftotal,0) from payroll_summary WHERE idpayrollsum = @idpayrollsum
			SELECT @totalOT= COALESCE(totalOT,0) from payroll_summary WHERE idpayrollsum = @idpayrollsum
			SELECT @totalOT= COALESCE(totalOT,0) from payroll_summary WHERE idpayrollsum = @idpayrollsum
			SELECT @tardiness= Tardiness from payroll_summary WHERE idpayrollsum = @idpayrollsum

			SELECT @totalgross = CAST(@totalsalary as float)+cast(@totalOT as float)+cast(@totalND as float)+CAST(@totalamount AS FLOAT)-cast(@tardiness as float) 
			
			SET @sqladjustmentupdatepayrollsum = ('UPDATE payroll_summary SET adjustment=' + @totalamount + ' ,adjustment2=' + @totalamount2 + ' ,grossalary=' + @totalgross + ' WHERE idpayrollsum='+ @idpayrollsum + '')
			execute(@sqladjustmentupdatepayrollsum)
					   
	--  SET @ConcatenatedValue = CONCAT(CONVERT(VARCHAR, @id), ' | ', CONVERT(VARCHAR, @amount) , ' | ',CONVERT(VARCHAR, @idpayrollsum) )
	--  print @ConcatenatedValue	   
	   
	   FETCH NEXT FROM myCursor INTO @idemployee,@idadjustment
    END
	CLOSE myCursor
	DEALLOCATE myCursor
-----------------------------------------ENd Adjustment---------------------------------------------------- 





------------------------------------------------------SSS Process 30th-------------------------------------------

--DECLARE @idclient int =17
--DECLARE @PayrollPeriodStart varchar(20) = '2023-14-16'
--declare @idDepartment int = 17


declare @currentday INT
declare @cut2start INT
declare @idemployeesss int
declare @counter int = 0
declare @sssbasis varchar(7)
DECLARE @idpayrollsum2 varchar(20)
DECLARE @ConcatenatedValue2 VARCHAR(MAX)
 
DECLARE @forssstotalgross float
DECLARE @forssstotalgrossprevious as float
DECLARE @forsssgrandtotalgross float

DECLARE @ssseegrossprevious as float
DECLARE @ssseegross as float 
DECLARE @ssseegrossfinal as float 
DECLARE @ssseegrossfinal2 AS FLOAT
DECLARE @ssseegross2 float 

DECLARE @sssERgrossprevious as float
DECLARE @sssergross as float
DECLARE @sssERgrossfinal as float
DECLARE @sssergrossfinal2 as float
DECLARE @sssergross2 float 

DECLARE @sssECCgrossprevious AS FLOAT
DECLARE @eccgross as float
DECLARE @sssECCgrossfinal AS FLOAT
DECLARE @sssECCgrossfinal2 as float
DECLARE @eccgross2 float

 
DECLARE @forssstotalbasic float
DECLARE @ssseebasic as float 
DECLARE @ssserbasic as float

DECLARE @eccbasic as float 
DECLARE @TDAYSSS AS FLOAT

--DECLARE @PayrollPeriodStart1 VARCHAR(20) = '2023-04-16'
declare @previouscuttoff as date
SET @previouscuttoff = DATEADD(DAY, -1, @PayrollPeriodStart)

  
DECLARE myCursor2 CURSOR FOR
-- open payroll summary      

SELECT employee_id,sssbasis FROM payroll_summary where idclientp = @idclient and Date_Start=@PayrollPeriodStart and department_codep = @idDepartment  order by idpayrollsum
 
	OPEN myCursor2
   
   FETCH NEXT FROM myCursor2 INTO @idemployeesss,@sssbasis
	WHILE @@FETCH_STATUS = 0
	
	BEGIN
				--SET @Counter = @Counter + 1
				--- get the max idpayroll		
				
				SELECT TOP 1  @idpayrollsum2 =  idpayrollsum FROM payroll_summary where Employee_id = @idemployeesss and idclientp = @idclient and Date_Start= @PayrollPeriodStart  order by grossalary desc
				
				SELECT @forssstotalgrossprevious= COALESCE(Sum(grossalary),0) from payroll_summary WHERE Employee_id = @idemployeesss and  idclientp = @idclient and Date_End= @previouscuttoff  
				SELECT @forssstotalgross= COALESCE(Sum(grossalary),0) from payroll_summary WHERE Employee_id = @idemployeesss and  idclientp = @idclient and Date_Start= @PayrollPeriodStart  
				SELECT @forsssgrandtotalgross = CAST(@forssstotalgross as float)+cast(@forssstotalgrossprevious as float)
				SELECT @TDAYSSS= COALESCE(Sum(noofdayswork),0) from payroll_summary WHERE Employee_id = @idemployeesss and  idclientp = @idclient and Date_Start= @PayrollPeriodStart  --TOTALNO OF DAYS
			
				--EE
				SELECT @ssseegrossprevious = COALESCE(Sum(contributionSSSEE),0) from payroll_summary WHERE Employee_id = @idemployeesss and  idclientp = @idclient and Date_End= @previouscuttoff
				SELECT TOP 1  @ssseegross = EmployeeSSS FROM SSS where Range <= @forsssgrandtotalgross order by Range desc
				
				--- below is the final computation of sss SSS EMPLOYEE
				SELECT @ssseegrossfinal = CAST(@ssseegross as float)- cast(@ssseegrossprevious as float)
				SELECT TOP 1  @ssseegross2 = EmployeeSSS FROM SSS where Range <= @forssstotalgross order by Range desc --for ecom case 
				
				--ER			   				
				SELECT @sssERgrossprevious = COALESCE(Sum(contributionSSSER),0) from payroll_summary WHERE Employee_id = @idemployeesss and  idclientp = @idclient and Date_End= @previouscuttoff
				SELECT TOP 1  @sssERgross = EmployerSSS FROM SSS where Range <= @forsssgrandtotalgross order by Range desc
				
				--below is the final computation if SSS employer 
				SELECT @sssERgrossfinal = CAST(@sssERgross as float)- cast(@sssERgrossprevious as float)
				SELECT TOP 1  @sssERgross2 = EmployerSSS FROM SSS where Range <= @forssstotalgross order by Range desc -- for ecom ase 
				
				--ecc
				SELECT @sssECCgrossprevious = COALESCE(Sum(contributionSSSECC),0) from payroll_summary WHERE Employee_id = @idemployeesss and  idclientp = @idclient and Date_End= @previouscuttoff
				SELECT TOP 1  @eccgross = EmployerECC FROM SSS where Range <= @forsssgrandtotalgross order by Range desc
				
				--below is the computation of ECC 
				SELECT @sssECCgrossfinal = cast(@eccgross as float)- CAST(@sssECCgrossprevious as float)
				SELECT TOP 1  @eccgross2 = EmployerECC FROM SSS where Range <= @forssstotalgross order by Range desc --- for ecom case 

				-- SSS basic option
				SELECT @forssstotalbasic= COALESCE(Sum(basic),0) from payroll_summary WHERE Employee_id = @idemployeesss and  idclientp = @idclient and Date_Start= @PayrollPeriodStart 
				SELECT TOP 1  @ssseebasic = EmployeeSSS FROM SSS where Range <= @forssstotalgross order by Range desc
				SELECT TOP 1  @ssserbasic = EmployerSSS FROM SSS where Range <= @forssstotalgross order by Range desc
				SELECT TOP 1  @eccbasic = EmployerECC FROM SSS where Range <= @forssstotalgross order by Range desc
				-- END SSS basic option		
							
				--------EMPLOYEEE GROSS PROCESS		
				Set @ssseegrossfinal2 =
					CASE 
						WHEN @idclient = 12345 THEN  --- E-COM CASE 
							CASE 
								WHEN @TDAYSSS < 3.5 THEN 0 
								WHEN @TDAYSSS >=3.5 THEN @ssseegross2
							END

						ELSE --- UNIFIED PROCESS BELOW
							CASE 
								WHEN @forssstotalgross <=1000 THEN 0
								WHEN @forssstotalgross >1000 THEN @ssseegrossfinal
							END
					END;
				

				--------EMPLOYEER GROSS PROCESS		
				Set @sssergrossfinal2 =
					CASE 
						WHEN @idclient = 12345 THEN  --- E-COM CASE 
							CASE 
								WHEN @TDAYSSS < 3.5 THEN 0 
								WHEN @TDAYSSS >=3.5 THEN @sssERgross2
							END
						ELSE --- UNIFIED PROCESS BELOW
							CASE 
								WHEN @forssstotalgross <=1000 THEN 0
								WHEN @forssstotalgross >1000 THEN @sssERgrossfinal
							END
					END;


				--------EMPLOYEE ECC GROSS PROCESS		
				Set @sssECCgrossfinal2 =
					CASE 
						WHEN @idclient = 12345 THEN  --- E-COM CASE 
							CASE 
								WHEN @TDAYSSS < 3.5 THEN 0 
								WHEN @TDAYSSS >=3.5 THEN @eccgross2
							END
						ELSE --- NORMAL PROCESS BELOW
							CASE 
								WHEN @forssstotalgross <=1000 THEN 0
								WHEN @forssstotalgross >1000 THEN @sssECCgrossfinal
							END
					END;

												
			if @sssbasis = 'Gross'
		  		update payroll_summary set contributionSSSEE = @ssseegrossfinal2,contributionSSSER=@sssergrossfinal2,contributionSSSECC =@sssECCgrossfinal2 where idpayrollsum=@idpayrollsum2
				--Print 'Gross'
			
			if @sssbasis = 'Basic'								
				update payroll_summary set contributionSSSEE = @ssseegrossfinal2,contributionSSSER=@ssserbasic,contributionSSSECC =@eccbasic where idpayrollsum=@idpayrollsum2
				--print 'Basic'				

	FETCH NEXT FROM myCursor2 INTO @idemployeesss,@sssbasis
	END
	CLOSE myCursor2
	DEALLOCATE myCursor2
	---------------------------------------------------End SSS PRocess -------------------------------------------------------------------------

	---------------------------------------------- Start Philhealth process --------------------------------------------------------------------

	
--DECLARE @idclient int =17
--DECLARE @PayrollPeriodStart varchar(20) = '2023-05-01'
--declare @idDepartment int = 17

-- DECLARE @pConcatenatedValue2 VARCHAR(MAX)
 declare @pcounter int = 0
DECLARE @pcurrentday INT
DECLARE @pcut2start INT
DECLARE @idemployeephi int

DECLARE @phibasis varchar(7)
DECLARE @phiidpayrollsum2 varchar(20)
DECLARE @forphitotalgross AS FLOAT

declare @previousphiee as float 
declare @previousphier as float

DECLARE @forphitotalbasic float
declare @forphitotalbasicprevious as float
declare @forphigrandtotalbasic as float

DECLARE @phipercent DECIMAL(5, 2)
DECLARE @phipercent2 DECIMAL(5, 2)
DECLARE @TDAYSPHI AS FLOAT


DECLARE @phiIDgross as int 
DECLARE @phiIDbasic as int
DECLARE @phiIDbasic2 as float

DECLARE @phiee as float
DECLARE @phieevalue1 as float
DECLARE @phieevalue3 as float 
DECLARE @phieebasic AS FLOAT

DECLARE @phier as float
DECLARE @phiervalue1 as float
DECLARE @phierbasic AS FLOAT


--DECLARE @PayrollPeriodStart1 VARCHAR(20) = '2023-04-16'
declare @previouscuttoffphi as date
SET @previouscuttoffphi = DATEADD(DAY, -1, @PayrollPeriodStart)
 
     
DECLARE myCursor3 CURSOR FOR
-- open payroll summary      

SELECT employee_id,philhealthbasis FROM payroll_summary where idclientp = @idclient and Date_Start=@PayrollPeriodStart and department_codep = @idDepartment  order by idpayrollsum
 
	OPEN myCursor3
   
   FETCH NEXT FROM myCursor3 INTO @idemployeephi,@phibasis
	WHILE @@FETCH_STATUS = 0
	
	BEGIN
				--	SET @pCounter = @pCounter + 1
				--- get the max idpayroll
			
				SELECT TOP 1  @phiidpayrollsum2 =  idpayrollsum FROM payroll_summary where Employee_id = @idemployeephi and idclientp = @idclient and Date_Start= @PayrollPeriodStart  order by grossalary desc --Get max idpayrollsumid 
				
				SELECT @forphitotalgross= COALESCE(Sum(grossalary),0) from payroll_summary WHERE Employee_id = @idemployeephi and  idclientp = @idclient and Date_Start= @PayrollPeriodStart  
				SELECT @forphitotalbasic= COALESCE(Sum(basic),0) from payroll_summary WHERE Employee_id = @idemployeephi and  idclientp = @idclient and Date_Start= @PayrollPeriodStart  --basic Basis
				
				SELECT @forphitotalbasicprevious= COALESCE(Sum(basic),0) from payroll_summary WHERE Employee_id = @idemployeephi and  idclientp = @idclient and Date_End= @previouscuttoffphi  --Previous Basic
				SELECT @forphigrandtotalbasic = CAST(@forphitotalbasic as float)+ cast(@forphitotalbasicprevious as float) -- grandtoal basic

				SELECT @TDAYSPHI= COALESCE(Sum(noofdayswork),0) from payroll_summary WHERE Employee_id = @idemployeephi and  idclientp = @idclient and Date_Start= @PayrollPeriodStart  --TOTALNO OF DAYS
			
				
				SELECT @previousphiee= COALESCE(Sum(contributionphilhealthEE),0) from payroll_summary WHERE Employee_id = @idemployeephi and  idclientp = @idclient and Date_End= @previouscuttoffphi  --Previous EE	
				SELECT @previousphier= COALESCE(Sum(contributionphilhealthER),0) from payroll_summary WHERE Employee_id = @idemployeephi and  idclientp = @idclient and Date_End= @previouscuttoffphi  --previous ER
	
									
				SELECT TOP 1  @phiIDgross = idphilhealth FROM Philhealth_2018 where Range <= @forphitotalbasic order by Range desc -- get id from philheal2018 gross reference
				
				SELECT TOP 1  @phiIDbasic = idphilhealth FROM Philhealth_2018 where Range <= @forphigrandtotalbasic order by Range desc --get id from philheal2018 basic reference
				SELECT TOP 1  @phiIDbasic2 = idphilhealth FROM Philhealth_2018 where Range <= @forphitotalbasic order by Range desc --get id from philheal2018 basic reference
				
			
				SELECT  @phieevalue1 = Employeephil FROM Philhealth_2018 where idphilhealth = @phiIDbasic --get the value of philhealt ee
				SELECT  @phiervalue1 = Employerphil FROM Philhealth_2018 where idphilhealth = @phiIDbasic --get the value of philhealt er
				
				SELECT  @phipercent = valPercentage FROM Philhealth_2018 where idphilhealth = @phiIDbasic --get the value of percent
				SELECT  @phipercent2 = valPercentage FROM Philhealth_2018 where idphilhealth = 2 --CONSTANT ID TO GET THE RIGHT PERCENTAGE

				
	----basic employee							   					 				  
				SET @phieebasic =  
					CASE 
						WHEN @idclient = 12345678 THEN	 --ecom case 	
						CASE 
							WHEN @TDAYSPHI < 3.5 THEN 0 
							WHEN @TDAYSPHI >=3.5 then
								CASE  						
									WHEN @forphitotalbasic <=1000 THEN 0 --- just get the amount from philhealthealth column
									WHEN @forphitotalbasic >=1000 and @forphitotalbasic <=5000 THEN (200/2)
									WHEN @forphitotalbasic >=5000 and @forphitotalbasic <=79999.99 THEN (@forphitotalbasic*@phipercent2)/2
								END
							ELSE 
							0 ---- tdas <4
						END	  ---- END CASE OF E-COM

						
						ELSE ---------------------UNIFIED  Process-----------------------------
						CASE 
							WHEN @forphitotalgross >=1000 THEN 
							CASE 
								WHEN @phiIDbasic = 1 THEN @phieevalue1 --- just get the amount from philhealthealth column
								WHEN @phiIDbasic = 2 THEN ((@forphigrandtotalbasic*@phipercent)/2)-@previousphiee
								WHEN @phiIDbasic = 3 THEN @phieevalue1 --- just get the amount from philhealthealth column
							END
							ELSE
							0
						END
					END;
				------------------------End Employee Computation -------------------------------------------------------

							   

				--- Basic Employer---------------SAME AS PHILHEALTH EMPLOYE NO NEED TO ENHANCE
							
				SET @phierbasic= 
					CASE  
						WHEN @phiIDbasic = 1 THEN @phieevalue1 --- just get the amount from philhealthealth column
						WHEN @phiIDbasic = 2 THEN (@forphitotalbasic*@phipercent)/2
						WHEN @phiIDbasic = 3 THEN @phieevalue1 --- just get the amount from philhealthealth column
					END;
				----End Employer Computation 

				
			if @phibasis = 'Gross'						
	  			 update payroll_summary set contributionphilhealthEE = @phiee,contributionphilhealthER=@phier where idpayrollsum=@phiidpayrollsum2
			if @phibasis = 'Basic'					
				update payroll_summary set contributionphilhealthEE = @phieebasic,contributionphilhealthER=@phieebasic where idpayrollsum=@phiidpayrollsum2
			
	FETCH NEXT FROM myCursor3 INTO @idemployeephi,@phibasis
	END
	CLOSE myCursor3
	DEALLOCATE myCursor3


	---------------------------------------------- END Philhealth process --------------------------------------------------------------------


	---------------------------------------------- Start Pagibig process --------------------------------------------------------------------

--DECLARE @idclient int =17
--DECLARE @PayrollPeriodStart varchar(20) = '2023-05-01'
--declare @idDepartment int = 17


 declare @pagcurrentday INT
 declare @pagcut2start INT
 declare @idemployeepag int
 declare @pagcounter int = 0
 declare @pagbasis varchar(7)
 DECLARE @idpayrollsum4 varchar(20)
 
 DECLARE @forpagtotalgross float
 
 DECLARE @previouspagee float
 DECLARE @previouspager float
 
 DECLARE @pageegross as float 
 DECLARE @pagergross as float
 
 DECLARE @forpagtotalbasic float
 
 DECLARE @pageebasic as float 
 DECLARE @pagerbasic as float

 DECLARE @phieebasicfinal2 as float
 DECLARE @phierbasicfinal2 as float

 DECLARE @phieegrossfinal2 as float
 DECLARE @phiergrossfinal2 as float

 --DECLARE @PayrollPeriodStart1 VARCHAR(20) = '2023-04-16'
declare @previouscuttoffpag as date
SET @previouscuttoffpag = DATEADD(DAY, -1, @PayrollPeriodStart)


    
DECLARE myCursor4 CURSOR FOR
-- open payroll summary      

SELECT employee_id,sssbasis FROM payroll_summary where idclientp = @idclient and Date_Start=@PayrollPeriodStart and department_codep = @idDepartment  order by idpayrollsum
 
	OPEN myCursor4
   
   FETCH NEXT FROM myCursor4 INTO @idemployeepag,@pagbasis
	WHILE @@FETCH_STATUS = 0
	
	BEGIN
			--SET @Counter = @Counter + 1
			--- get the max idpayroll
				SELECT TOP 1  @idpayrollsum4 =  idpayrollsum FROM payroll_summary where Employee_id = @idemployeepag and idclientp = @idclient and Date_Start= @PayrollPeriodStart  order by grossalary desc
			
				SELECT @forpagtotalgross= COALESCE(Sum(grossalary),0) from payroll_summary WHERE Employee_id = @idemployeepag and  idclientp = @idclient and Date_Start= @PayrollPeriodStart  
				
				
				SELECT @previouspagee= COALESCE(Sum(contributionPagibigEE),0) from payroll_summary WHERE Employee_id = @idemployeepag and  idclientp = @idclient and Date_End= @previouscuttoffpag  --Previous EE	
				SELECT @previouspager= COALESCE(Sum(contributionPagibigER),0) from payroll_summary WHERE Employee_id = @idemployeepag and  idclientp = @idclient and Date_End= @previouscuttoffpag  --previous ER
	
				
				SELECT TOP 1  @pageegross = 100
				SELECT TOP 1  @pagergross = 100
								
				SELECT @forpagtotalbasic= COALESCE(Sum(basic),0) from payroll_summary WHERE Employee_id = @idemployeepag and  idclientp = @idclient and Date_Start= @PayrollPeriodStart 
				SELECT TOP 1  @pageebasic = 100
				SELECT TOP 1  @pagerbasic = 100
						
						
			
				--------pag ibig EMPLOYEEE GROSS PROCESS		
				Set @phieegrossfinal2 =
					CASE 
						WHEN @idclient = 12345678 THEN  --- E-COM CASE 
							CASE 
								WHEN @TDAYSSS < 3.5 THEN 0 
								WHEN @TDAYSSS >=3.5 THEN @pageegross-@previouspagee
							END
						ELSE --- UNIFIED PROCESS BELOW
							CASE 
								WHEN @forpagtotalgross <=1000 THEN 0
								WHEN @forpagtotalgross >1000 THEN @pageegross-@previouspagee
							END
					END;

				--------EMPLOYEER GROSS PROCESS		
				Set @phiergrossfinal2 =
					CASE 
						WHEN @idclient = 12345678 THEN  --- E-COM CASE 
							CASE 
								WHEN @TDAYSSS < 4 THEN 0 
								WHEN @TDAYSSS >=4 THEN @pagERgross
							END
						ELSE --- UNIFIED PROCESS BELOW like dusit
							CASE 
								WHEN @forpagtotalgross <=1000 THEN 0
								WHEN @forpagtotalgross >1000 THEN @pagERgross-@previouspager
							END
					END;

													   


			if @pagbasis = 'Gross'
		  		update payroll_summary set contributionPagibigEE = @phieegrossfinal2,contributionPagibigER=@phiergrossfinal2 where idpayrollsum=@idpayrollsum4
				--Print 'Gross'
			 if @pagbasis = 'Basic'								
				update payroll_summary set contributionPagibigEE = @phieebasicfinal2,contributionPagibigER=@phierbasicfinal2 where idpayrollsum=@idpayrollsum4
				--print 'Basic'				

	FETCH NEXT FROM myCursor4 INTO @idemployeepag,@phibasis
	END
	CLOSE myCursor4
	DEALLOCATE myCursor4

	   
----------------------------------------- RUN OTHER DEDUCTION HERE -------------------------------------------
--DECLARE @idclient int =17
--DECLARE @PayrollPeriodStart varchar(20) = '2023-05-01'
--declare @idDepartment int = 17


Declare @Didemployee int
Declare @Damount varchar(20)
DECLARE @DConcatenatedValue VARCHAR(MAX)
DECLARE @Didpayrollsum varchar(20)
DECLARE @Dsqldeductionupdate Nvarchar(max)
declare @Dsqlotherdeductionupdatepayrollsum Nvarchar(max)
DECLARE @Diddeduction varchar(20)
DECLARE @Dtotalamount varchar(20)
DECLARE @Dtotalamount2 varchar(20)

DECLARE @Dtotalsss varchar(20)
DECLARE @Dtotalphi varchar(20)
DECLARE @Dtotalpag varchar(20)

DECLARE @DGrosssalary varchar(20)
DECLARE @Dtotaldeduction1 varchar(20)
DECLARE @DNetamount varchar(20)
DECLARE @DNetamount2 varchar(20)


DECLARE myCursor1 CURSOR FOR
     
	SELECT employee_id,idotherdeduction FROM otherdeduction where idclientdeduction = @idclient and Date_Start= @PayrollPeriodStart  and iddepartmentdeduction = @idDepartment order by idotherdeduction
	  
	OPEN myCursor1
   
	FETCH NEXT FROM myCursor1 INTO @Didemployee,@Diddeduction
	WHILE @@FETCH_STATUS = 0
	BEGIN
	  --- get the max idpayroll
	  SELECT TOP 1  @Didpayrollsum =  idpayrollsum FROM payroll_summary where Employee_id = @Didemployee and idclientp = @idclient and Date_Start= @PayrollPeriodStart  and department_codep = @idDepartment order by grossalary desc
	  	   
		   --update OTHERDEDUCTION table idpayrollsum system assure that high gross amt should be place 
			SET @Dsqldeductionupdate = ('UPDATE otherdeduction SET idpayrollsum=' + @Didpayrollsum + ' WHERE idotherdeduction='+ @Diddeduction + '')
			execute(@Dsqldeductionupdate)

			--totalamount  adjusment
			SELECT @Dtotalamount= COALESCE(Sum(amount),0) from otherdeduction WHERE idpayrollsum = @Didpayrollsum 
			SELECT @Dtotalamount2= COALESCE(Sum(amount2),0) from otherdeduction WHERE idpayrollsum = @Didpayrollsum 

		 SET @Dsqlotherdeductionupdatepayrollsum = ('UPDATE payroll_summary SET Other_Deduction=' + @Dtotalamount + ' ,Other_Deduction2=' + @Dtotalamount2 + '  WHERE idpayrollsum='+ @Didpayrollsum + '')
			execute(@Dsqlotherdeductionupdatepayrollsum)
					   
	--  SET @ConcatenatedValue = CONCAT(CONVERT(VARCHAR, @id), ' | ', CONVERT(VARCHAR, @amount) , ' | ',CONVERT(VARCHAR, @idpayrollsum) )
	--  print @ConcatenatedValue	   
		   FETCH NEXT FROM myCursor1 INTO @Didemployee,@Diddeduction
    END
	CLOSE myCursor1
	DEALLOCATE myCursor1
-----------------------------------------ENd Other deduction---------------------------------------------------- 



---------------------------------------------Total net amount single 30th ------------------------------------------

--DECLARE @idclient int =17
--DECLARE @PayrollPeriodStart varchar(20) = '2023-05-01'
--declare @idDepartment int = 17

DECLARE @countempidfinal int
DECLARE @Tidpayrollsum varchar(20)
DECLARE @Temployee_id varchar(20)
DECLARE @Tsqltotaldeduction Nvarchar(max)
declare @Tsqltotalnet Nvarchar(max)

DECLARE @Totherdeduction varchar(20)
DECLARE @Totherdeduction2 varchar(20)
DECLARE @TTotaldeduction varchar(20)

DECLARE @Tsss varchar(20)
DECLARE @Tphi varchar(20)
DECLARE @Tpag varchar(20)

DECLARE @TGrosssalary varchar(20)
DECLARE @Ttotaldeduction1 varchar(20)
DECLARE @TNetamount varchar(20)
DECLARE @TNetamount2 varchar(20)


DECLARE myCursor5 CURSOR FOR
     
	SELECT idpayrollsum,Employee_id FROM payroll_summary where idclientp = @idclient and Date_Start= @PayrollPeriodStart  and department_codep = @idDepartment order by idpayrollsum
	  
	OPEN myCursor5
   
	FETCH NEXT FROM myCursor5 INTO @Tidpayrollsum,@Temployee_id
	WHILE @@FETCH_STATUS = 0
	BEGIN
	   		SELECT @countempidfinal =  COUNT(Employee_id) FROM  payroll_summary where Employee_id = @TEmployee_id and idclientp = @idclient and Date_Start= @PayrollPeriodStart
			  			
			SELECT @Tsss= COALESCE(contributionSSSEE,0) from payroll_summary WHERE idpayrollsum = @Tidpayrollsum
			SELECT @Tphi= COALESCE(contributionphilhealthEE,0) from payroll_summary WHERE idpayrollsum = @Tidpayrollsum
			SELECT @Tpag= COALESCE(contributionpagibigEE,0) from payroll_summary WHERE idpayrollsum = @Tidpayrollsum
						
			SELECT @Totherdeduction= COALESCE(other_deduction,0) from payroll_summary WHERE idpayrollsum = @Tidpayrollsum 
			SELECT @Totherdeduction2= COALESCE(other_deduction2,0) from payroll_summary WHERE idpayrollsum = @Tidpayrollsum 

			SELECT @TTotaldeduction = CAST(@Tsss as float)+CAST(@Tphi as float)+CAST(@Tpag as float)+CAST(@Totherdeduction as float)	

			IF @countempidfinal = 1 --only one trx 
			UPDATE payroll_summary SET Totaldeduction= @TTotaldeduction   WHERE idpayrollsum=@Tidpayrollsum 

			--SET @Tsqltotaldeduction = ('UPDATE payroll_summary SET Totaldeduction=' + @TTotaldeduction + '  WHERE idpayrollsum='+ @Tidpayrollsum + '')
			--execute(@Tsqltotaldeduction)

			SELECT @TGrosssalary = COALESCE(grossalary,0) from payroll_summary WHERE idpayrollsum = @Tidpayrollsum
			
			SELECT @TNetamount = CAST(@TGrosssalary as float)-CAST(@TTotaldeduction as float)	
			SELECT @TNetamount2 = CAST(@TGrosssalary as float)-CAST(@TTotaldeduction as float)+@Totherdeduction2
			
			IF @countempidfinal = 1 --only one payroll
			UPDATE payroll_summary SET netamount= @TNetamount  ,netamount2= @TNetamount2   WHERE idpayrollsum= @Tidpayrollsum 
			
			--SET @Tsqltotalnet = ('UPDATE payroll_summary SET netamount=' + @TNetamount + ' ,netamount2=' + @TNetamount2 + '  WHERE idpayrollsum='+ @Tidpayrollsum + '')
			--execute(@Tsqltotalnet)
					   	   
		   FETCH NEXT FROM myCursor5 INTO @Tidpayrollsum,@Temployee_id
    END
	CLOSE myCursor5
	DEALLOCATE myCursor5
	  	  -------------------------------------- End Total Net amount single------------------------------------------------------


		  ---------------------------------------------Total net amount and others Double------------------------------------------

--DECLARE @idclient int =4
--DECLARE @PayrollPeriodStart varchar(20) = '2023-04-01'
--declare @idDepartment int = 98


DECLARE @Tidpayrollsumdouble varchar(20)
DECLARE @TEmployee_iddouble varchar(20)
DECLARE @countempidfinaldouble int

DECLARE @Tsqltotaldeductiondouble Nvarchar(max)
DECLARE @Tsqltotaldeduction2double Nvarchar(max)

declare @Tsqltotalnetdouble Nvarchar(max)
declare @Tsqltotalnet2double Nvarchar(max)

DECLARE @Totherdeductiondouble varchar(20)
DECLARE @Totherdeduction2double varchar(20)

DECLARE @TTotaldeductiondouble varchar(20)
DECLARE @Ttotaldeduction2double varchar(30)

DECLARE @Tsssdouble varchar(30)
DECLARE @Tphidouble varchar(30)
DECLARE @Tpagdouble varchar(30)

DECLARE @TGrosssalarydouble varchar(30)
DECLARE @TNetamountdouble varchar(30)
DECLARE @TNetamount2double varchar(30)


DECLARE myCursor6 CURSOR FOR
--- insert here the script with double payroll	chaNge paramete to dynamic
--- script below shows only the list of employee with double entry 

SELECT        idpayrollsum, Employee_id
FROM            payroll_summary
WHERE        (Employee_id IN
                             (SELECT        Employee_id
                               FROM            payroll_summary AS payroll_summary_1
                               GROUP BY Employee_id, idclientp, Date_Start
                               HAVING         (COUNT(*) > 1) AND (Date_Start = @PayrollPeriodStart) AND (idclientp = @idclient))) AND (idclientp = @idclient) AND (Date_Start = @PayrollPeriodStart)
ORDER BY Employee_id	

	
	OPEN myCursor6
   
	FETCH NEXT FROM myCursor6 INTO @Tidpayrollsumdouble,@TEmployee_iddouble
	WHILE @@FETCH_STATUS = 0
	BEGIN
	   		
			--- get the max idpayroll
			--SELECT TOP 1  @maxidpayrollsumfinal = idpayrollsum FROM payroll_summary where Employee_id = @TEmployee_id and idclientp = @idclient and Date_Start= @PayrollPeriodStart  order by grossalary desc
			
			--SELECT @countempidfinal =  COUNT(Employee_id) FROM  payroll_summary where Employee_id = @TEmployee_iddouble and idclientp = @idclient and Date_Start= @PayrollPeriodStart
			
		
			SELECT @Tsssdouble= COALESCE(contributionSSSEE,0) from payroll_summary WHERE idpayrollsum = @Tidpayrollsumdouble
			SELECT @Tphidouble= COALESCE(contributionphilhealthEE,0) from payroll_summary WHERE idpayrollsum = @Tidpayrollsumdouble
			SELECT @Tpagdouble= COALESCE(contributionpagibigEE,0) from payroll_summary WHERE idpayrollsum = @Tidpayrollsumdouble
						
			SELECT @Totherdeductiondouble= COALESCE(other_deduction,0) from payroll_summary WHERE idpayrollsum = @Tidpayrollsumdouble
			SELECT @Totherdeduction2double= COALESCE(other_deduction2,0) from payroll_summary WHERE idpayrollsum = @Tidpayrollsumdouble

			SELECT @TTotaldeductiondouble = CAST(@Tsssdouble as float)+CAST(@Tphidouble as float)+CAST(@Tpagdouble as float)+CAST(@Totherdeductiondouble as float)	
								
			
			 UPDATE payroll_summary SET Totaldeduction =  @TTotaldeductiondouble WHERE idpayrollsum =  @Tidpayrollsumdouble 
			
			--SET @Tsqltotaldeductiondouble = 'UPDATE payroll_summary SET Totaldeduction = ' + @TTotaldeductiondouble + ' WHERE idpayrollsum =  ' + @Tidpayrollsumdouble + ''
			
			--BEGIN TRANSACTION; 
			--	execute(@Tsqltotaldeductiondouble)			
			--	execute(@Tsqltotaldeduction2double)
			--COMMIT;
			

			SELECT @TGrosssalarydouble = COALESCE(grossalary,0) from payroll_summary WHERE idpayrollsum = @Tidpayrollsumdouble
			SELECT @TNetamountdouble = CAST(@TGrosssalarydouble as float)-CAST(@TTotaldeductiondouble as float)	
			SELECT @TNetamount2double =CAST(@TGrosssalarydouble as float)-CAST(@TTotaldeductiondouble as float)+@Totherdeduction2double
			
			UPDATE payroll_summary SET netamount=@TNetamountdouble ,netamount2=  @TNetamount2double   WHERE idpayrollsum= @Tidpayrollsumdouble 
			--update dups tag as 1 mean color red, its an idicator shows in payroll summary form
			update payroll_summary SET dupstag = 1 WHERE idpayrollsum= @Tidpayrollsumdouble


			--SET @Tsqltotalnetdouble = 'UPDATE payroll_summary SET netamount=' + @TNetamountdouble + ' ,netamount2=' + @TNetamount2double + '  WHERE idpayrollsum='+ @Tidpayrollsumdouble + ''
			
			--BEGIN TRANSACTION; 
			--execute(@Tsqltotalnetdouble)
			--execute(@Tsqltotalnet2double)
			--COMMIT;
			
		   FETCH NEXT FROM myCursor6 INTO @Tidpayrollsumdouble,@TEmployee_iddouble
    END
	CLOSE myCursor6
	DEALLOCATE myCursor6
	  	  -------------------------------------- End Total Net amount Double--------------------------------------------------------




END