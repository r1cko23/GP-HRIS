

CREATE PROCEDURE [dbo].[42bf00bd-6230-462f-a118-a3d93166c3b9V230INDmassSSSPRO]

@idclient varchar(20),
@PayrollPeriodStart Date

--@idemployee INT,
--@idDepartment INT,
--@idclientbranch INT,
--@grossamt float,
--@basicamt float,
--@otherbasisamt float, 
--@UserName varchar(20),
--@withsss bit,
--@withssspro bit,
--@withphi bit,
--@withpag bit,
--@monthlysalary float, 
--@fixrate varchar(1),
--@idpayroll int

AS
BEGIN

DECLARE @idemployee0 INT
DECLARE @idpayroll0 INT
DECLARE @sssbasis0 NVARCHAR(20)
DECLARE @grossamt0 float
DECLARE @basicamt0 float
DECLARE @otherbasisamt0 float
DECLARE @withsss NVARCHAR(20)
DECLARE @withssspro NVARCHAR(20)
DECLARE @withphi NVARCHAR(20)
DECLARE @withpag NVARCHAR(20)
DECLARE @monthlysalary float 
DECLARE @fixrate0 varchar(1)

DECLARE myCursor0 CURSOR FOR
SELECT idpayrollsum,employee_id,sssbasis,grossalary,basic,othermandatorybasis,withsss,withssspro,withphi,withpag,fixmonthlyrate,othermandatorybasis,fixrate
FROM payroll_summary where idclientp = @idclient and Date_Start=@PayrollPeriodStart order by idpayrollsum desc
OPEN myCursor0
   
   FETCH NEXT FROM myCursor0 INTO @idpayroll0,@idemployee0,@sssbasis0,@grossamt0,@basicamt0,@otherbasisamt0,@withsss,@withssspro,@withphi,@withpag,@monthlysalary,@otherbasisamt0,@fixrate0
	WHILE @@FETCH_STATUS = 0
	
	BEGIN

	---------------------------------------------------Start SSS Pro PRocess -------------------------------------------------------------------------

declare @procurrentday INT
declare @procut2start INT
declare @proidemployeesss int
declare @procounter int = 0
declare @prosssbasis varchar(7)
DECLARE @proidpayrollsum2 varchar(20)


DECLARE @proforssstotalgrossprevious as float
DECLARE @proforssstotalbasicprevious as float
DECLARE @proforssstotalotherbasisprevious as float


DECLARE @proforssstotalgross float
DECLARE @proforssstotalbasic float
DECLARE @proforssstotalotherbasis float

DECLARE @proforsssgrandtotalgross1 float
DECLARE @proforsssgrandtotalbasic1 float
DECLARE @proforsssgrandtotalotherbasis1 float



DECLARE @proforsssgrandtotalgross float
DECLARE @proforsssgrandtotalbasic float
DECLARE @proforsssgrandtotalotherbasis float


DECLARE @prossseegross as float			--store get the value of sss current cuttoff
DECLARE @prosssergross as float	

DECLARE @prossseebasic as float 
DECLARE @prossserbasic as float

DECLARE @prossseeotherbasis as float 
DECLARE @prossserotherbasis as float


DECLARE @prossseegrossfinal as float		--store both previous and current value SSS
DECLARE @prosssergrossfinal as float

DECLARE @prossseebasicfinal as float		--store both previous and current value SSS
DECLARE @prossserbasicfinal as float	

DECLARE @prossseeotherbasisfinal as float		--store both previous and current value SSS
DECLARE @prossserotherbasisfinal as float	



declare @proforssstotalgross1 float 




DECLARE @prossseeprevious as float	--store previous cuttof store 


DECLARE @prossseegrossfinal2 AS FLOAT		--sore the value of sss depends on the condition fall
DECLARE @prosssergrossfinal2 as float

DECLARE @prossseebasicfinal2 AS FLOAT		--sore the value of sss depends on the condition fall
DECLARE @prossserbasicfinal2 as float

DECLARE @prossseeotherbasisfinal2 AS FLOAT		--sore the value of sss depends on the condition fall
DECLARE @prossserotherbasisfinal2 as float


DECLARE @prossseegrossfinal3 AS FLOAT		--store the sssgross final2
DECLARE @prossseegross2 float				--used it for e-com case value soon to be remove 

DECLARE @prossserprevious as float 
	


DECLARE @prosssergrossfinal3 as float
DECLARE @prosssergross2 float 

DECLARE @prosssECCgrossprevious AS FLOAT
DECLARE @proeccgross as float
DECLARE @prosssECCgrossfinal AS FLOAT
DECLARE @prosssECCgrossfinal2 as float
DECLARE @prosssECCgrossfinal3 as float
DECLARE @proeccgross2 float

DECLARE @proforsssgrandtotalotherbasis2 float



DECLARE @proeccbasic as float 
DECLARE @proTDAYSSS AS FLOAT
DECLARE @procountempidsss int

DECLARE @prossseeotherentry float 
DECLARE @prossserotherentry float 


--DECLARE @PayrollPeriodStart1 VARCHAR(20) = '2023-04-16'
declare @propreviouscuttoff as date
SET @propreviouscuttoff = DATEADD(DAY, -1, @PayrollPeriodStart)

  
DECLARE myCursor8 CURSOR FOR
-- open payroll summary      

SELECT employee_id,sssbasis FROM payroll_summary where idclientp = @idclient and Date_Start=@PayrollPeriodStart  AND employee_id = @idemployee0  order by idpayrollsum
 
	OPEN myCursor8
   
   FETCH NEXT FROM myCursor8 INTO @proidemployeesss,@prosssbasis
	WHILE @@FETCH_STATUS = 0
	
	BEGIN
				--SET @Counter = @Counter + 1
				--- get the max idpayroll		
				
				SELECT TOP 1  @PROidpayrollsum2 =  idpayrollsum FROM payroll_summary where Employee_id = @PROidemployeesss and idclientp = @idclient and Date_Start= @PayrollPeriodStart  order by grossalary desc
				--count trx
				SELECT @procountempidsss =  COUNT(Employee_id) FROM  payroll_summary where Employee_id = @PROidemployeesss and idclientp = @idclient and Date_Start= @PayrollPeriodStart
				
			 --previous cuttoff
			 --SELECT @proforssstotalgrossprevious= COALESCE(Sum(grossamttaxable),0) from payroll_summary WHERE Employee_id = @idemployeesss and  idclientp = @idclient and Date_End= @previouscuttoff  
				SELECT @proforssstotalgrossprevious= COALESCE(Sum(grossamttaxable),0) from payroll_summary WHERE Employee_id = @PROidemployeesss and Date_End= @PROpreviouscuttoff  
				SELECT @proforssstotalbasicprevious= COALESCE(Sum(basic),0) from payroll_summary WHERE Employee_id = @proidemployeesss and Date_End= @PROpreviouscuttoff  
				SELECT @proforssstotalotherbasisprevious= COALESCE(Sum(othermandatorybasis),0) from payroll_summary WHERE Employee_id = @proidemployeesss and Date_End= @PROpreviouscuttoff  
			
			--current cuttoff
				SELECT @proforssstotalgross= COALESCE(Sum(grossamttaxable),0) from payroll_summary WHERE Employee_id = @proidemployeesss and  idclientp = @idclient and Date_Start= @PayrollPeriodStart  and  idpayrollsum < @idpayroll0
				SELECT @proforssstotalbasic= COALESCE(Sum(basic),0) from payroll_summary WHERE Employee_id = @proidemployeesss and  idclientp = @idclient and Date_Start= @PayrollPeriodStart  and  idpayrollsum < @idpayroll0
				SELECT @proforssstotalotherbasis= COALESCE(Sum(othermandatorybasis),0) from payroll_summary WHERE Employee_id = @proidemployeesss and  idclientp = @idclient and Date_Start= @PayrollPeriodStart  and  idpayrollsum < @idpayroll0
				
				SELECT @proforsssgrandtotalotherbasis1 =  (@otherbasisamt0+@proforssstotalotherbasis+@proforssstotalotherbasisprevious)
				
				-- this condition set if otherbasis is greater than monthly salay then use monthly salary as reference to compare to sss table 
				SET @proforsssgrandtotalotherbasis2 = 
					CASE 
						WHEN @proforsssgrandtotalotherbasis1>@monthlysalary THEN @monthlysalary
						else
						@proforsssgrandtotalotherbasis1
					END;


				SELECT @proforsssgrandtotalgross = @grossamt0+@proforssstotalgross+@proforssstotalgrossprevious
				SELECT @proforsssgrandtotalbasic = @basicamt0+@proforssstotalbasic+@proforssstotalbasicprevious
				SELECT @proforsssgrandtotalotherbasis =@proforsssgrandtotalotherbasis2





				
				SELECT TOP 1  @prossseegross = eepro FROM SSS where Range <= @proforsssgrandtotalgross order by Range desc		--total ssspro gross ee
				SELECT TOP 1  @prosssergross = erpro FROM SSS where Range <= @proforsssgrandtotalgross order by Range desc		--total ssspro gross er
				
				SELECT TOP 1  @prossseebasic = eepro FROM SSS where Range <= @proforsssgrandtotalbasic order by Range desc		--total ssspro basic ee
				SELECT TOP 1  @prossserbasic = erpro FROM SSS where Range <= @proforsssgrandtotalbasic order by Range desc		--total ssspro basic er

				SELECT TOP 1  @prossseeotherbasis = eepro FROM SSS where Range <= @proforsssgrandtotalotherbasis order by Range desc		--total ssspro basic ee
				SELECT TOP 1  @prossserotherbasis = erpro FROM SSS where Range <= @proforsssgrandtotalotherbasis order by Range desc		--total ssspro basic er


				--SELECT @proforsssgrandtotalgross1 = @grossamt0+@proforssstotalgross
				--SELECT @proforsssgrandtotalbasic1 = @basicamt0+@proforssstotalbasic
				--SELECT @proforsssgrandtotalotherbasis1 = @otherbasisamt0+@proforssstotalotherbasis




				--SSSPRO PREVIOUS CUTTOFF
				SELECT @prossseeprevious = COALESCE(Sum(contributionSSSEEpro),0) from payroll_summary WHERE Employee_id = @proidemployeesss and Date_End= @PROpreviouscuttoff
				SELECT @prossserprevious = COALESCE(Sum(contributionSSSERpro),0) from payroll_summary WHERE Employee_id = @proidemployeesss  and Date_End= @PROpreviouscuttoff
								   				
				--sssproee othertrx		
				SELECT @prossseeotherentry = COALESCE(Sum(contributionSSSEEpro),0) from payroll_summary WHERE Employee_id = @proidemployeesss and  Date_Start= @PayrollPeriodStart and idpayrollsum < @idpayroll0
		
				--sssproer othertrx
				SELECT @prossserotherentry = COALESCE(Sum(contributionSSSERpro),0) from payroll_summary WHERE Employee_id = @proidemployeesss and Date_Start= @PayrollPeriodStart and idpayrollsum < @idpayroll0
				
				

				--EE PRO gross reference
				--EE SSS pro
				SELECT @prossseegrossfinal = CAST(@prossseegross as float)- cast(@prossseeprevious as float)--- below is the final computation of sss SSS EMPLOYEE
				--ER SSS pro			   				
				SELECT @prosssergrossfinal = CAST(@prosssergross as float)- cast(@prossserprevious as float) --below is the final computation if SSS employer 
				
				-- SSS basic Referennce
				SELECT @prossseebasicfinal = CAST(@prossseebasic as float)- cast(@prossseeprevious as float)--- below is the final computation of sss SSS EMPLOYEE
				--ER SSS pro			   				
				SELECT @prossserbasicfinal = CAST(@prossserbasic as float)- cast(@prossserprevious as float) --below is the final computation if SSS employer 
			
				-- SSS otherbasis Referennce
				SELECT @prossseeotherbasisfinal = CAST(@prossseeotherbasis as float)- cast(@prossseeprevious as float)--- below is the final computation of sss SSS EMPLOYEE
				--ER SSS pro			   				
				SELECT @prossserotherbasisfinal = CAST(@prossserotherbasis as float)- cast(@prossserprevious as float) --below is the final computation if SSS employer 
								
						

				--------EMPLOYEEE GROSS PROCESS		
				Set @prossseegrossfinal2 =
						CASE 
							WHEN @proforsssgrandtotalgross <=2000.00 THEN 0
							WHEN @proforsssgrandtotalgross >2000.00 THEN @prossseegrossfinal
						END
				
				--------EMPLOYEER GROSS PROCESS		
				Set @prosssergrossfinal2 =
						CASE 
							WHEN @proforsssgrandtotalgross <=2000 THEN 0
							WHEN @proforsssgrandtotalgross >2000 THEN @prosssERgrossfinal
						END

				
				--------EMPLOYEEE BASIC PROCESS		
				Set @prossseebasicfinal2 =
						CASE 
							WHEN @proforsssgrandtotalbasic <=2000.00 THEN 0
							WHEN @proforsssgrandtotalbasic >2000.00 THEN @prossseebasicfinal
						END
				
				--------EMPLOYEER BASIC PROCESS		
				Set @prossserbasicfinal2 =
						CASE 
							WHEN @proforsssgrandtotalbasic <=2000 THEN 0
							WHEN @proforsssgrandtotalbasic >2000 THEN @prosssERbasicfinal
						END


				--------EMPLOYEEE OTHER BASIS PROCESS		
				Set @prossseeotherbasisfinal2 =
						CASE 
							WHEN @proforsssgrandtotalotherbasis <=2000.00 THEN 0
							WHEN @proforsssgrandtotalotherbasis >2000.00 THEN @prossseeotherbasisfinal
						END
				
				--------EMPLOYEER BASIC PROCESS		
				Set @prossserotherbasisfinal2 =
						CASE 
							WHEN @proforsssgrandtotalotherbasis <=2000 THEN 0
							WHEN @proforsssgrandtotalotherbasis >2000 THEN @prossserotherbasisfinal
						END



												
			if @PROsssbasis = 'gross' AND @PROcountempidsss =1 and @withssspro='Y' 
		  	Begin
				SET @prossseegrossfinal3 = @prossseegrossfinal2
				SET @prosssergrossfinal3 = @prosssergrossfinal2				
			End
			else if @PROsssbasis = 'gross' and @PROcountempidsss >1  
		  	Begin 				
				SET @prossseegrossfinal3 = cast(@prossseegrossfinal2 as float) - cast(@prossseeotherentry as float)
				SET @prosssergrossfinal3 = cast(@prosssergrossfinal2 as float) - cast(@prossserotherentry as float)
				



			End 
			
			if @PROsssbasis = 'basic' AND @PROcountempidsss =1 and @withssspro='Y' 
		  	Begin
				SET @prossseegrossfinal3 = @prossseebasicfinal2
				SET @prosssergrossfinal3 = @prossserbasicfinal2				
			End
			


			if @PROsssbasis = 'basic' and @PROcountempidsss >1  and @withssspro='Y' 
		  	Begin
				SET @prossseegrossfinal3 = @prossseebasicfinal2
				SET @prosssergrossfinal3 = @prossserbasicfinal2			
			End 


			if @PROsssbasis = 'others' AND @PROcountempidsss =1 and @withssspro='Y'  and @idclient <> 44
		  	Begin
				SET @prossseegrossfinal3 = @prossseeotherbasisfinal2
				SET @prosssergrossfinal3 = @prossserotherbasisfinal2				
			End
			else if @PROsssbasis = 'others' and @PROcountempidsss >1  and @withssspro='Y'  and @idclient <> 44
		  	Begin
				SET @prossseegrossfinal3 = @prossseeotherbasisfinal2
				SET @prosssergrossfinal3 = @prossserotherbasisfinal2			
			End 


			if @PROsssbasis = 'others' AND @PROcountempidsss =1 and @withssspro='Y'  and @idclient = 44
		  	Begin
				SET @prossseegrossfinal3 = @prossseeotherbasisfinal2
				SET @prosssergrossfinal3 = @prossserotherbasisfinal2				
			End
			else if @PROsssbasis = 'others' and @PROcountempidsss >1  and @withssspro='Y'  and @idclient = 44
		  	Begin
				SET @prossseegrossfinal3 = cast(@prossseeotherbasisfinal2 as float) - cast(@prossseeotherentry as float)
				SET @prosssergrossfinal3 = cast(@prossserotherbasisfinal2 as float) - cast(@prossserotherentry as float)		
			End 



			
	FETCH NEXT FROM myCursor8 INTO @PROidemployeesss,@PROsssbasis
	END
	CLOSE myCursor8
	DEALLOCATE myCursor8



	update payroll_summary
	set contributionSSSEEpro = @prossseegrossfinal3
	  , contributionSSSERpro = @prosssergrossfinal3
	--  , basicforsss =  @forssstotalgrossprevious --added by cdp for previous amount @proforssstotalgrossprevious
	where idpayrollsum = @idpayroll0		



	---------------------------------------------------End SSS Pro PRocess -------------------------------------------------------------------------
	

 
		      FETCH NEXT FROM myCursor0 INTO @idpayroll0,@idemployee0,@sssbasis0,@grossamt0,@basicamt0,@otherbasisamt0,@withsss,@withssspro,@withphi,@withpag,@monthlysalary,@otherbasisamt0,@fixrate0
	END
	CLOSE myCursor0
	DEALLOCATE myCursor0

END




