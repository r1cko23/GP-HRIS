
CREATE PROCEDURE [dbo].[42bf00bd-6230-462f-a118-a3d93166c3b9V230INDOLD 3-3-2024]

@idemployee INT,
@idclient varchar(20),
@idDepartment INT,
@PayrollPeriodStart Date,
@idclientbranch INT,
@grossamt float,
@basicamt float,
@UserName varchar(20),
@withsss bit,
@withphi bit,
@withpag bit,
@idpayroll int

AS
BEGIN

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

declare @forssstotalgross1 float 


DECLARE @forssstotalgrossprevious as float
DECLARE @forssstotalbasicprevious FLOAT

DECLARE @forsssgrandtotalgross float
DECLARE @forsssgrandtotalbasic float

DECLARE @forsssgrandtotalgross1 float
DECLARE @forsssgrandtotalbasic1 FLOAT

DECLARE @ssseegrossprevious as float	--store previous cuttof store 
DECLARE @ssseegross as float			--store get the value of sss current cuttoff


DECLARE @ssseegrossfinal as float		--store both previous and current value SSS
DECLARE @ssseebasicfinal as float

DECLARE @ssseegrossfinal2 AS FLOAT		--sore the value of sss depends on the condition fall
DECLARE @ssseefinal3 AS FLOAT		    --store the sssgross final2

DECLARE @ssseegross2 float				--used it for e-com case value soon to be remove 
DECLARE @ssseebasic2 float

DECLARE @sssergrossprevious as float 
DECLARE @ssseebasicprevious float


DECLARE @sssergross as float		

DECLARE @sssergrossfinal as float	
DECLARE @sssERbasicfinal float


DECLARE @sssergrossfinal2 as float
DECLARE @ssserbasicfinal2 float


DECLARE @ssseebasicfinal2 float

DECLARE @ssserfinal3 as float



DECLARE @sssergross2 float 
DECLARE @ssserbasic2 FLOAT

DECLARE @sssECCgrossprevious AS FLOAT
DECLARE @sssECCbasicprevious FLOAT

DECLARE @eccgross as float

DECLARE @sssECCgrossfinal AS FLOAT
DECLARE @sssECCbasicfinal AS FLOAT

DECLARE @sssECCgrossfinal2 as float
DECLARE @sssECCbasicfinal2 as float


DECLARE @sssECCfinal3 as float
--DECLARE @eccgross2 float

 
DECLARE @forssstotalbasic float

DECLARE @ssseebasic as float 
DECLARE @ssserbasic as float

DECLARE @eccbasic as float 
DECLARE @countempidsss int


--DECLARE @PayrollPeriodStart1 VARCHAR(20) = '2023-04-16'
declare @previouscuttoff as date
SET @previouscuttoff = DATEADD(DAY, -1, @PayrollPeriodStart)

  
DECLARE myCursor2 CURSOR FOR
-- open payroll summary      

SELECT employee_id,sssbasis FROM payroll_summary where idclientp = @idclient and Date_Start=@PayrollPeriodStart and department_codep = @idDepartment AND employee_id = @idemployee  order by idpayrollsum
 
	OPEN myCursor2
   
   FETCH NEXT FROM myCursor2 INTO @idemployeesss,@sssbasis
	WHILE @@FETCH_STATUS = 0
	
	BEGIN
				--SET @Counter = @Counter + 1
				--- get the max idpayroll		
				
				SELECT TOP 1  @idpayrollsum2 =  idpayrollsum FROM payroll_summary where Employee_id = @idemployeesss and idclientp = @idclient and Date_Start= @PayrollPeriodStart  order by grossalary desc
				--count trx
				SELECT @countempidsss =  COUNT(Employee_id) FROM  payroll_summary where Employee_id = @idemployeesss and idclientp = @idclient and Date_Start= @PayrollPeriodStart
				

				--SELECT @forssstotalgrossprevious= COALESCE(Sum(grossamttaxable),0) from payroll_summary WHERE Employee_id = @idemployeesss and  idclientp = @idclient and Date_End= @previouscuttoff  
				SELECT @forssstotalgrossprevious= COALESCE(Sum(grossamttaxable),0) from payroll_summary WHERE Employee_id = @idemployeesss and  Date_End= @previouscuttoff  
				SELECT @forssstotalbasicprevious= COALESCE(Sum(basic),0) from payroll_summary WHERE Employee_id = @idemployeesss and  Date_End= @previouscuttoff  
				


				SELECT @forssstotalgross= COALESCE(Sum(grossamttaxable),0) from payroll_summary WHERE Employee_id = @idemployeesss and  idclientp = @idclient and Date_Start= @PayrollPeriodStart  and  idpayrollsum <> @idpayroll
				SELECT @forssstotalbasic= COALESCE(Sum(basic),0) from payroll_summary WHERE Employee_id = @idemployeesss and  idclientp = @idclient and Date_Start= @PayrollPeriodStart and  idpayrollsum <> @idpayroll

				
				
				SELECT @forsssgrandtotalgross1 = @grossamt+@forssstotalgross
				SELECT @forsssgrandtotalbasic1 = @basicamt+@forssstotalbasic

				SELECT @forsssgrandtotalgross = @grossamt+@forssstotalgross+@forssstotalgrossprevious				
				SELECT @forsssgrandtotalbasic = @basicamt+@forssstotalbasic+@forssstotalbasicprevious
										
				
		
				SELECT @ssseegrossprevious = COALESCE(Sum(contributionSSSEE),0) from payroll_summary WHERE Employee_id = @idemployeesss and  Date_End= @previouscuttoff
				SELECT @ssseebasicprevious = COALESCE(Sum(contributionSSSEE),0) from payroll_summary WHERE Employee_id = @idemployeesss and  Date_End= @previouscuttoff

				SELECT @sssERgrossprevious = COALESCE(Sum(contributionSSSER),0) from payroll_summary WHERE Employee_id = @idemployeesss and Date_End= @previouscuttoff
				
		
				SELECT TOP 1  @ssseegross = EmployeeSSS FROM SSS where Range <= @forsssgrandtotalgross order by Range desc
				SELECT TOP 1  @ssseebasic = EmployeeSSS FROM SSS where Range <= @forsssgrandtotalbasic order by Range desc

				SELECT TOP 1  @sssERgross = EmployerSSS FROM SSS where Range <= @forsssgrandtotalgross order by Range desc
				SELECT TOP 1  @ssserbasic = EmployerSSS FROM SSS where Range <= @forsssgrandtotalbasic order by Range desc



				
				--- below is the final computation of sss SSS EMPLOYEE
				SELECT @ssseegrossfinal = CAST(@ssseegross as float)- cast(@ssseegrossprevious as float)
				SELECT @ssseebasicfinal = CAST(@ssseebasic as float)- cast(@ssseebasicprevious as float)
												
					
				--- below is the final computation of sss SSS EMPLOYER					
					
				SELECT @sssERgrossfinal = CAST(@sssERgross as float)-cast(@sssERgrossprevious as float)
				SELECT @sssERbasicfinal = CAST(@ssserbasic as float)-cast(@sssERgrossprevious as float)
													
				
				--ecc
				--SELECT @sssECCgrossprevious = COALESCE(Sum(contributionSSSECC),0) from payroll_summary WHERE Employee_id = @idemployeesss and  idclientp = @idclient and Date_End= @previouscuttoff
				SELECT @sssECCgrossprevious = COALESCE(Sum(contributionSSSECC),0) from payroll_summary WHERE Employee_id = @idemployeesss and Date_End= @previouscuttoff
				SELECT @sssECCbasicprevious = COALESCE(Sum(contributionSSSECC),0) from payroll_summary WHERE Employee_id = @idemployeesss and Date_End= @previouscuttoff
				

				SELECT TOP 1  @eccgross = EmployerECC FROM SSS where Range <= @forsssgrandtotalgross order by Range desc
				SELECT TOP 1  @eccbasic = EmployerECC FROM SSS where Range <= @forsssgrandtotalbasic order by Range desc
				
				--below is the computation of ECC 
				SELECT @sssECCgrossfinal = cast(@eccgross as float)- CAST(@sssECCgrossprevious as float)
				SELECT @sssECCbasicfinal = cast(@eccbasic as float)- CAST(@sssECCbasicprevious as float)
				
				--SELECT TOP 1  @eccgross2 = EmployerECC FROM SSS where Range <= @forssstotalgross order by Range desc --- for ecom case 

							
		
							
				--EMPLOYEEE GROSS PROCESS		
				Set @ssseegrossfinal2 =
					CASE 
						WHEN @forsssgrandtotalgross <=2000.00 THEN 0
						WHEN @forsssgrandtotalgross >2000.00 THEN @sssEEgrossfinal
					END
					
				--EMPLOYEER GROSS PROCESS		
				Set @sssergrossfinal2 =
					CASE 
						WHEN @forsssgrandtotalgross <=2000 THEN 0
						WHEN @forsssgrandtotalgross >2000 THEN @sssERgrossfinal
					END
					
				--EMPLOYEE ECC GROSS PROCESS		
				Set @sssECCgrossfinal2 =
					 
					CASE 
						WHEN @forsssgrandtotalgross <=2000 THEN 0
						WHEN @forsssgrandtotalgross >2000 THEN @sssECCgrossfinal
					END
			
		

					
			if @sssbasis = 'Gross' AND @countempidsss =1  and @withsss=1 
		  		
			Begin
				--update payroll_summary set contributionSSSEE = @ssseegrossfinal2,contributionSSSER=@sssergrossfinal2,contributionSSSECC =@sssECCgrossfinal2 where idpayrollsum=@idpayrollsum2
				--Print 'Gross'
				SET @ssseefinal3 = @ssseegrossfinal2
				SET @ssserfinal3 = @sssergrossfinal2
				SET @sssECCfinal3 = @sssECCgrossfinal2
			End
			else if @sssbasis = 'Gross' and @countempidsss >1  and  @withsss =1
		  	BEgin	
				SET @ssseefinal3 = @ssseegrossfinal2
				SET @ssserfinal3 = @sssergrossfinal2
				SET @sssECCfinal3 = @sssECCgrossfinal2

				--update payroll_summary set contributionSSSEE = @ssseegrossfinal2,contributionSSSER=@sssergrossfinal2,contributionSSSECC=@sssECCgrossfinal2 where idpayrollsum=@idpayrollsum2 and  Employee_id = @idemployeesss and idclientp = @idclient and Date_Start= @PayrollPeriodStart
				--update other sssee to zero 
				--update payroll_summary set contributionSSSEE =0,contributionSSSER=0,contributionSSSECC =0 where idpayrollsum<>@idpayrollsum2 and  Employee_id = @idemployeesss and idclientp = @idclient and Employee_id = @idemployeesss and Date_Start= @PayrollPeriodStart
			End 


		--EMPLOYEEE BASIC PROCESS		
				Set @ssseebasicfinal2 =
					CASE 
						WHEN @forsssgrandtotalbasic1 <=1000.00 THEN 0
						WHEN @forsssgrandtotalbasic1 >1000.00 THEN @ssseebasicfinal
					END
				Set @ssserbasicfinal2 =
					CASE 
						WHEN @forsssgrandtotalbasic1 <=1000.00 THEN 0
						WHEN @forsssgrandtotalbasic1 >1000.00 THEN @ssserbasicfinal
					END
				Set @sssECCbasicfinal2 =
					 
					CASE 
						WHEN @forsssgrandtotalbasic1 <=1000 THEN 0
						WHEN @forsssgrandtotalbasic1 >1000 THEN @sssECCbasicfinal
					END
							
				

							   									   					 				  				  				 
			if @sssbasis = 'Basic' and @countempidsss =1  and @withsss=1 
			Begin
				SET @ssseefinal3 = @ssseebasicfinal2
				SET @ssserfinal3 = @ssserbasicfinal2
				--SET @ssserfinal3 = 123456
				SET @sssECCfinal3 = @sssECCbasicfinal2								
			--update payroll_summary set contributionSSSEE = @ssseebasic,contributionSSSER=@ssserbasic,contributionSSSECC =@eccbasic where idpayrollsum=@idpayrollsum2
			End 
			
			else if @sssbasis = 'Basic' and @countempidsss >1  and @withsss=1 --if more than 2 records basic reference
		  	BEgin		
				SET @ssseefinal3 = @ssseebasicfinal2
				SET @ssserfinal3 = @ssserbasicfinal2
				SET @ssseefinal3 = @sssECCbasicfinal2
			End 
						

		--previous setupof basic 
			--if @sssbasis = 'Basic'								
			--	update payroll_summary set contributionSSSEE = @ssseebasic,contributionSSSER=@ssserbasic,contributionSSSECC =@eccbasic where idpayrollsum=@idpayrollsum2
			--print 'Basic'				

	FETCH NEXT FROM myCursor2 INTO @idemployeesss,@sssbasis
	END
	CLOSE myCursor2
	DEALLOCATE myCursor2
	---------------------------------------------------End SSS PRocess -------------------------------------------------------------------------




	---------------------------------------------------Start SSS Pro PRocess -------------------------------------------------------------------------

declare @procurrentday INT
declare @procut2start INT
declare @proidemployeesss int
declare @procounter int = 0
declare @prosssbasis varchar(7)
DECLARE @proidpayrollsum2 varchar(20)

 
DECLARE @proforssstotalgross float
declare @proforssstotalgross1 float 
DECLARE @proforssstotalgrossprevious as float
DECLARE @proforsssgrandtotalgross float
DECLARE @proforsssgrandtotalgross1 float


DECLARE @prossseegrossprevious as float	--store previous cuttof store 
DECLARE @prossseegross as float			--store get the value of sss current cuttoff
DECLARE @prossseegrossfinal as float		--store both previous and current value SSS
DECLARE @prossseegrossfinal2 AS FLOAT		--sore the value of sss depends on the condition fall
DECLARE @prossseegrossfinal3 AS FLOAT		--store the sssgross final2
DECLARE @prossseegross2 float				--used it for e-com case value soon to be remove 

DECLARE @prosssergrossprevious as float 
DECLARE @prosssergross as float		
DECLARE @prosssergrossfinal as float	
DECLARE @prosssergrossfinal2 as float
DECLARE @prosssergrossfinal3 as float
DECLARE @prosssergross2 float 

DECLARE @prosssECCgrossprevious AS FLOAT
DECLARE @proeccgross as float
DECLARE @prosssECCgrossfinal AS FLOAT
DECLARE @prosssECCgrossfinal2 as float
DECLARE @prosssECCgrossfinal3 as float
DECLARE @proeccgross2 float

 
DECLARE @proforssstotalbasic float
DECLARE @prossseebasic as float 
DECLARE @prossserbasic as float

DECLARE @proeccbasic as float 
DECLARE @proTDAYSSS AS FLOAT
DECLARE @procountempidsss int

DECLARE @proforssstotalbasicprevious AS FLOAT 
DECLARE @proforsssgrandtotalbasic1 AS FLOAT 
DECLARE @proforsssgrandtotalbasic AS FLOAT 

DECLARE @prossseebasicfinal2	as float

DECLARE @prossseebasicprevious AS FLOAT
DECLARE @prossseebasicfinal AS FLOAT 

DECLARE @prossserbasicprevious AS FLOAT
DECLARE @prossserbasicfinal AS FLOAT



--DECLARE @PayrollPeriodStart1 VARCHAR(20) = '2023-04-16'
declare @propreviouscuttoff as date
SET @propreviouscuttoff = DATEADD(DAY, -1, @PayrollPeriodStart)

  
DECLARE myCursor8 CURSOR FOR
-- open payroll summary      

SELECT employee_id,sssbasis FROM payroll_summary where idclientp = @idclient and Date_Start=@PayrollPeriodStart and department_codep = @idDepartment AND employee_id = @idemployee  order by idpayrollsum
 
	OPEN myCursor8
   
   FETCH NEXT FROM myCursor8 INTO @proidemployeesss,@prosssbasis
	WHILE @@FETCH_STATUS = 0
	
	BEGIN
				--SET @Counter = @Counter + 1
				--- get the max idpayroll		
				
				SELECT TOP 1  @idpayrollsum2 =  idpayrollsum FROM payroll_summary where Employee_id = @idemployeesss and idclientp = @idclient and Date_Start= @PayrollPeriodStart  order by grossalary desc
				--count trx
				SELECT @procountempidsss =  COUNT(Employee_id) FROM  payroll_summary where Employee_id = @idemployeesss and idclientp = @idclient and Date_Start= @PayrollPeriodStart
				

				--SELECT @proforssstotalgrossprevious= COALESCE(Sum(grossamttaxable),0) from payroll_summary WHERE Employee_id = @idemployeesss and  idclientp = @idclient and Date_End= @previouscuttoff  
				SELECT @proforssstotalgrossprevious= COALESCE(Sum(grossamttaxable),0) from payroll_summary WHERE Employee_id = @idemployeesss and Date_End= @previouscuttoff  
				SELECT @proforssstotalgross= COALESCE(Sum(grossamttaxable),0) from payroll_summary WHERE Employee_id = @idemployeesss and  idclientp = @idclient and Date_Start= @PayrollPeriodStart  and  idpayrollsum <> @idpayroll
				
				SELECT @proforssstotalbasicprevious= COALESCE(Sum(basic),0) from payroll_summary WHERE Employee_id = @idemployeesss and Date_End= @previouscuttoff  
				SELECT @proforssstotalbasic= COALESCE(Sum(basic),0) from payroll_summary WHERE Employee_id = @idemployeesss and  idclientp = @idclient and Date_Start= @PayrollPeriodStart  and  idpayrollsum <> @idpayroll
				
				
				SELECT @proforsssgrandtotalgross1 = @grossamt+@proforssstotalgross
				SELECT @proforsssgrandtotalgross = @grossamt+@proforssstotalgross+@proforssstotalgrossprevious

				SELECT @proforsssgrandtotalbasic1 = @basicamt+@proforssstotalbasic
				SELECT @proforsssgrandtotalbasic = @basicamt+@proforssstotalbasic+@proforssstotalbasicprevious
									

				--EE gross PRO
				SELECT @prossseegrossprevious = COALESCE(Sum(contributionSSSEEpro),0) from payroll_summary WHERE Employee_id = @idemployeesss and Date_End= @previouscuttoff
				SELECT TOP 1  @prossseegross = eepro FROM SSS where Range <= @proforsssgrandtotalgross order by Range desc
				--- below is the final computation of sss SSS EMPLOYEE
				SELECT @prossseegrossfinal = CAST(@prossseegross as float)- cast(@prossseegrossprevious as float)
			
								
				--ER gross PRO			   				
				SELECT @prosssERgrossprevious = COALESCE(Sum(contributionSSSERpro),0) from payroll_summary WHERE Employee_id = @idemployeesss and Date_End= @previouscuttoff
				SELECT TOP 1  @prosssERgross = erpro FROM SSS where Range <= @proforsssgrandtotalgross order by Range desc
				--below is the final computation if SSS employer 
				SELECT @prosssERgrossfinal = CAST(@prosssERgross as float)- cast(@prosssergrossprevious as float)
			
			
				-- SSS basic option
				SELECT @prossseebasicprevious = COALESCE(Sum(contributionSSSEEpro),0) from payroll_summary WHERE Employee_id = @idemployeesss and Date_End= @previouscuttoff
				SELECT TOP 1  @prossseebasic = eepro FROM SSS where Range <= @forsssgrandtotalbasic order by Range desc
					--- below is the final computation of sss SSS EMPLOYEE basic
				SELECT @prossseebasicfinal = CAST(@prossseebasic as float)- cast(@prossseeBASICprevious as float)
				
				SELECT @prossserbasicprevious = COALESCE(Sum(contributionSSSERpro),0) from payroll_summary WHERE Employee_id = @idemployeesss and Date_End= @previouscuttoff
				SELECT TOP 1  @prossserbasic = erpro FROM SSS where Range <= @proforsssgrandtotalbasic order by Range desc
				SELECT @prossserbasicfinal = CAST(@prossserbasic as float)- cast(@prossseeBASICprevious as float)
				-- END SSS basic option		
		
		


				--------EMPLOYEEE GROSS PROCESS		
				Set @prossseegrossfinal2 =
				
							CASE 
								WHEN @proforsssgrandtotalgross <=2000.00 THEN 0
								WHEN @proforsssgrandtotalgross >2000.00 THEN @prosssEEgrossfinal
							END
				

				--------EMPLOYEER GROSS PROCESS		
				Set @prosssergrossfinal2 =
					CASE 
						WHEN @proforsssgrandtotalgross <=2000 THEN 0
						WHEN @proforsssgrandtotalgross >2000 THEN @prosssERgrossfinal
					END
					
				 
												
			if @sssbasis = 'Gross' AND @countempidsss =1 and @withsss=1 
		  	Begin
				SET @prossseegrossfinal3 = @prossseegrossfinal2
				SET @prosssergrossfinal3 = @prosssergrossfinal2
				
			End
			else if @sssbasis = 'Gross' and @countempidsss >1  
		  	BEgin
				
				SET @prossseegrossfinal3 = @prossseegrossfinal2
				SET @prosssergrossfinal3 = @prosssergrossfinal2
			End 
			

--SET basic prOCESS---------------------------------------------------------

			Set @prossseebasicfinal2 =
							CASE 
								WHEN @proforsssgrandtotalbasic <=2000.00 THEN 0
								WHEN @proforsssgrandtotalbasic >2000.00 THEN @prosssEEgrossfinal
							END
				

				--------EMPLOYEER GROSS PROCESS		
			Set @prosssergrossfinal2 =
					CASE 
						WHEN @proforsssgrandtotalbasic <=2000 THEN 0
						WHEN @proforsssgrandtotalbasic >2000 THEN @prosssERbasicfinal
					END



			if @sssbasis = 'basic' AND @countempidsss =1 and @withsss=1 
		  	Begin
				SET @prossseegrossfinal3 = @prossseegrossfinal2
				SET @prosssergrossfinal3 = @prosssergrossfinal2
				
			End
			else if @sssbasis = 'basic' and @countempidsss >1  
		  	BEgin
				
				SET @prossseegrossfinal3 = @prossseegrossfinal2
				SET @prosssergrossfinal3 = @prosssergrossfinal2
			End 



			
			
			-- old setup 
			--if @sssbasis = 'Basic'								
			--update payroll_summary set contributionSSSEE = @ssseebasic,contributionSSSER=@ssserbasic,contributionSSSECC =@eccbasic where idpayrollsum=@idpayrollsum2
			--print 'Basic'				

	FETCH NEXT FROM myCursor8 INTO @idemployeesss,@sssbasis
	END
	CLOSE myCursor8
	DEALLOCATE myCursor8








	---------------------------------------------------End SSS Pro PRocess -------------------------------------------------------------------------











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
DECLARE @phieebasic2 AS FLOAT

DECLARE @phier as float
DECLARE @phiervalue1 as float
DECLARE @phierbasic AS FLOAT
DECLARE @phierbasic2 AS FLOAT
DECLARE @countempidphi int

DECLARE @forphitotalgross1 FLOAT

--DECLARE @PayrollPeriodStart1 VARCHAR(20) = '2023-04-16'
declare @previouscuttoffphi as date
SET @previouscuttoffphi = DATEADD(DAY, -1, @PayrollPeriodStart)
 
     
DECLARE myCursor3 CURSOR FOR
-- open payroll summary      

SELECT employee_id,philhealthbasis FROM payroll_summary where idclientp = @idclient and Date_Start=@PayrollPeriodStart and department_codep = @idDepartment AND employee_id = @idemployee  order by idpayrollsum
 
	OPEN myCursor3
   
   FETCH NEXT FROM myCursor3 INTO @idemployeephi,@phibasis
	WHILE @@FETCH_STATUS = 0
	
	BEGIN
				--	SET @pCounter = @pCounter + 1
				--- get the max idpayroll
			
				SELECT TOP 1  @phiidpayrollsum2 =  idpayrollsum FROM payroll_summary where Employee_id = @idemployeephi and idclientp = @idclient and Date_Start= @PayrollPeriodStart  order by grossalary desc --Get max idpayrollsumid 
				SELECT @countempidphi =  COUNT(Employee_id) FROM  payroll_summary where Employee_id = @idemployeephi and idclientp = @idclient and Date_Start= @PayrollPeriodStart
				
				SELECT @forphitotalgross= COALESCE(Sum(grossamttaxable),0) from payroll_summary WHERE Employee_id = @idemployeephi and  idclientp = @idclient and Date_Start= @PayrollPeriodStart  
				SELECT @forphitotalgross1 = @grossamt+@forphitotalgross

				SELECT @forphitotalbasic= COALESCE(Sum(basic),0) from payroll_summary WHERE Employee_id = @idemployeephi and  idclientp = @idclient and Date_Start= @PayrollPeriodStart AND idpayrollsum <> @idpayroll  --basic Basis
				--SELECT @forphitotalbasicprevious= COALESCE(Sum(basic),0) from payroll_summary WHERE Employee_id = @idemployeephi and  idclientp = @idclient and Date_End= @previouscuttoffphi  --Previous Basic
				SELECT @forphitotalbasicprevious= COALESCE(Sum(basic),0) from payroll_summary WHERE Employee_id = @idemployeephi and Date_End= @previouscuttoffphi  --Previous Basic
				

				SELECT @forphigrandtotalbasic = @forphitotalbasic + @forphitotalbasicprevious +@basicamt -- grandtoal basic

				SELECT @TDAYSPHI= COALESCE(Sum(noofdayswork),0) from payroll_summary WHERE Employee_id = @idemployeephi and  idclientp = @idclient and Date_Start= @PayrollPeriodStart  --TOTALNO OF DAYS
			
				
				--SELECT @previousphiee= COALESCE(Sum(contributionphilhealthEE),0) from payroll_summary WHERE Employee_id = @idemployeephi and  idclientp = @idclient and Date_End= @previouscuttoffphi  --Previous EE	
				--SELECT @previousphier= COALESCE(Sum(contributionphilhealthER),0) from payroll_summary WHERE Employee_id = @idemployeephi and  idclientp = @idclient and Date_End= @previouscuttoffphi  --previous ER
				
				SELECT @previousphiee= COALESCE(Sum(contributionphilhealthEE),0) from payroll_summary WHERE Employee_id = @idemployeephi and Date_End= @previouscuttoffphi  --Previous EE	
				SELECT @previousphier= COALESCE(Sum(contributionphilhealthER),0) from payroll_summary WHERE Employee_id = @idemployeephi and Date_End= @previouscuttoffphi  --previous ER
	
									
				SELECT TOP 1  @phiIDgross = idphilhealth FROM Philhealth_2018 where Range <= @forphitotalbasic order by Range desc -- get id from philheal2018 gross current cuttoff reference
				
				SELECT TOP 1  @phiIDbasic = idphilhealth FROM Philhealth_2018 where Range <= @forphigrandtotalbasic order by Range desc --get id from philheal2018 basic reference bothprevioud and current
				
				SELECT TOP 1  @phiIDbasic2= idphilhealth FROM Philhealth_2018 where Range <= @forphitotalbasic order by Range desc --get id from philheal2018 basic reference
				
			
				SELECT  @phieevalue1 = Employeephil FROM Philhealth_2018 where idphilhealth = @phiIDbasic --get the value of philhealt ee
				SELECT  @phiervalue1 = Employerphil FROM Philhealth_2018 where idphilhealth = @phiIDbasic --get the value of philhealt er
				
				SELECT  @phipercent = valPercentage FROM Philhealth_2018 where idphilhealth = @phiIDbasic --get the value of percent
				SELECT  @phipercent2 = valPercentage FROM Philhealth_2018 where idphilhealth = 2 --CONSTANT ID TO GET THE RIGHT PERCENTAGE

				
	----basic employee							   					 				  
				SET @phieebasic =  
										
						CASE 
							WHEN @forphitotalgross1 >=1000.00 THEN 
							CASE 
								WHEN @phiIDbasic = 1 THEN @phieevalue1- @previousphiee --- just get the amount from philhealthealth column
								WHEN @phiIDbasic = 2 THEN ((@forphigrandtotalbasic*@phipercent)/2)-@previousphiee
								WHEN @phiIDbasic = 3 THEN @phieevalue1 --- just get the amount from philhealthealth column
							END
							ELSE
							0
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

				
			if @phibasis = 'Gross'	  --NOT YET ALIGN					
	  			Begin
					print 'test'
					-- update payroll_summary set contributionphilhealthEE = @phiee,contributionphilhealthER=@phier where idpayrollsum=@phiidpayrollsum2
					
				End
			if @phibasis = 'Basic' and @countempidphi =1 
				Begin
					--update payroll_summary set contributionphilhealthEE = @phieebasic,contributionphilhealthER=@phieebasic where idpayrollsum=@phiidpayrollsum2
					set @phieebasic2 = @phieebasic
					set @phierbasic2 = @phieebasic
				End
			else if @phibasis = 'Basic' and @countempidphi >1 
				Begin
					set @phieebasic2 = @phieebasic
					set @phierbasic2 = @phieebasic
					--print 'x'
					--update payroll_summary set contributionphilhealthEE = @phieebasic,contributionphilhealthER=@phieebasic where idpayrollsum= @phiidpayrollsum2 and  Employee_id = @idemployeephi and idclientp = @idclient and Date_Start= @PayrollPeriodStart
					--update payroll_summary set contributionphilhealthEE = 0,contributionphilhealthER=0 where idpayrollsum<> @phiidpayrollsum2 and  Employee_id = @idemployeephi and idclientp = @idclient and Employee_id = @idemployeephi and Date_Start= @PayrollPeriodStart
				End	


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
 DECLARE @pageebasic2 AS float

 DECLARE @pagerbasic as float
 DECLARE @pagerbasic2 as float

 DECLARE @phieebasicfinal2 as float
 DECLARE @phierbasicfinal2 as float

 DECLARE @phieegrossfinal2 as float
 DECLARE @phiergrossfinal2 as float

 DECLARE @countempidpag AS int
 DECLARE @pagibigcontribution AS FLOAT

 --DECLARE @PayrollPeriodStart1 VARCHAR(20) = '2023-04-16'
declare @previouscuttoffpag as date
SET @previouscuttoffpag = DATEADD(DAY, -1, @PayrollPeriodStart)


    
DECLARE myCursor4 CURSOR FOR
-- open payroll summary      

SELECT employee_id,sssbasis FROM payroll_summary where idclientp = @idclient and Date_Start=@PayrollPeriodStart and department_codep = @idDepartment AND employee_id = @idemployee  order by idpayrollsum
 
	OPEN myCursor4
   
   FETCH NEXT FROM myCursor4 INTO @idemployeepag,@pagbasis
	WHILE @@FETCH_STATUS = 0
	
	BEGIN
			--SET @Counter = @Counter + 1
			--- get the max idpayroll
				SELECT TOP 1  @idpayrollsum4 =  idpayrollsum FROM payroll_summary where Employee_id = @idemployeepag and idclientp = @idclient and Date_Start= @PayrollPeriodStart  order by grossalary desc
			--count trx
				SELECT @countempidpag =  COUNT(Employee_id) FROM  payroll_summary where Employee_id = @idemployeepag and idclientp = @idclient and Date_Start= @PayrollPeriodStart
			
				--SELECT @forpagtotalgross= COALESCE(Sum(grossamttaxable),0) from payroll_summary WHERE Employee_id = @idemployeepag and  idclientp = @idclient and Date_Start= @PayrollPeriodStart  
				SELECT @forpagtotalgross = @grossamt
				
				--SELECT @previouspagee= COALESCE(Sum(contributionPagibigEE),0) from payroll_summary WHERE Employee_id = @idemployeepag and  idclientp = @idclient and Date_End= @previouscuttoffpag  --Previous EE	
				--SELECT @previouspager= COALESCE(Sum(contributionPagibigER),0) from payroll_summary WHERE Employee_id = @idemployeepag and  idclientp = @idclient and Date_End= @previouscuttoffpag  --previous ER
				
				SELECT @previouspagee= COALESCE(Sum(contributionPagibigEE),0) from payroll_summary WHERE Employee_id = @idemployeepag  and Date_End= @previouscuttoffpag  --Previous EE	
				SELECT @previouspager= COALESCE(Sum(contributionPagibigER),0) from payroll_summary WHERE Employee_id = @idemployeepag  and Date_End= @previouscuttoffpag  --previous ER
					
				SELECT TOP 1  @pagibigcontribution= pagibigcontributionee FROM pagibigtable where idpagibig = 1   order by dateupdate desc
			
				SELECT TOP 1  @pageegross = @pagibigcontribution
				SELECT TOP 1  @pagergross = @pagibigcontribution
								
				--SELECT @forpagtotalbasic= COALESCE(Sum(basic),0) from payroll_summary WHERE Employee_id = @idemployeepag and  idclientp = @idclient and Date_Start= @PayrollPeriodStart 
				SELECT @forpagtotalbasic = @basicamt
				SELECT TOP 1  @pageebasic = @pagibigcontribution
				SELECT TOP 1  @pagerbasic = @pagibigcontribution
						
									
				--------pag ibig EMPLOYEEE GROSS PROCESS		
				Set @pageebasic =
					CASE 
						WHEN @forpagtotalgross <=1000 THEN 0
						WHEN @forpagtotalgross >1000 THEN @pageegross-@previouspagee
					END
					

				--------EMPLOYEER GROSS PROCESS SAME AS EE NO NEED THIS CONDTION	
				Set @pageegross =
					CASE 
								WHEN @forpagtotalgross <=1000 THEN 0
								WHEN @forpagtotalgross >1000 THEN @pagERgross-@previouspager
					END
					
						

			--if @pagbasis = 'Gross'
		  	--	update payroll_summary set contributionPagibigEE = @phieegrossfinal2,contributionPagibigER=@phiergrossfinal2 where idpayrollsum=@idpayrollsum4
				--Print 'Gross'
			 if @pagbasis = 'Basic' and @countempidpag	=1 					
				Begin
				--update payroll_summary set contributionPagibigEE = @phieebasicfinal2,contributionPagibigER=@phierbasicfinal2 where idpayrollsum=@idpayrollsum4
				--print 'Basic'
				
				set @pageebasic2 = @pageebasic
				set @pagerbasic2 = @pageebasic

				End
			
			else  if @pagbasis = 'Basic'and @countempidpag	>1 	
				Begin
					set @pageebasic2 = @pageebasic
					set @pagerbasic2 = @pageebasic
					--print 'x'
					--update payroll_summary set contributionPagibigEE = @pageebasic,contributionPagibigER=@pageebasic where idpayrollsum=@idpayrollsum4 and Employee_id = @idemployeepag and idclientp = @idclient and Date_Start= @PayrollPeriodStart
					--update payroll_summary set contributionPagibigEE = 0,contributionPagibigER=0 where idpayrollsum<>@idpayrollsum4 and Employee_id = @idemployeepag and idclientp = @idclient and Date_Start= @PayrollPeriodStart
				End
				--print 'Basic'

	FETCH NEXT FROM myCursor4 INTO @idemployeepag,@phibasis
	END
	CLOSE myCursor4
	DEALLOCATE myCursor4

	   
--------------------------------------------------------------------------Wtax-------------------------------------------
--DECLARE @idclient int =17
--DECLARE @PayrollPeriodStart varchar(20) = '2023-05-01'
--declare @idDepartment int = 17

DECLARE @wtaxbasis nvarchar(7)
SELECT TOP 1  @wtaxbasis =  wtaxbasis FROM payroll_summary where Employee_id = @idemployeepag and idclientp = @idclient and Date_Start= @PayrollPeriodStart 


DECLARE @idemployeewtax int
DECLARE @TOTALGROSS  FLOAT
DECLARE @TOTALMANDATORIESPREVIOUS FLOAT

DECLARE @WTAXCOMPENSATION FLOAT
DECLARE @TOTALMANDATORIES  FLOAT
DECLARE @TAXABLEINCOME FLOAT
 
 
DECLARE @TAXCOMPENSATIONLEVEL FLOAT
DECLARE @TAXOVER FLOAT
DECLARE @TAXPERCENT FLOAT
DECLARE @TAXPRESCRIBE FLOAT 
DECLARE @WTAXCOMPENSATIONFINAL FLOAT
DECLARE @PREVIOUSWTAX FLOAT

declare @previouscuttoffwtax as date
SET @previouscuttoffwtax = DATEADD(DAY, -1, @PayrollPeriodStart)

DECLARE myCursor7 CURSOR FOR
-- open payroll summary it also use this to select record where the data should fall

SELECT employee_id FROM payroll_summary where idclientp = @idclient and Date_Start=@PayrollPeriodStart and department_codep = @idDepartment AND employee_id = @idemployee  order by idpayrollsum
 
	OPEN myCursor7
   
   FETCH NEXT FROM myCursor7 INTO @idemployeewtax
	WHILE @@FETCH_STATUS = 0
	
	BEGIN

		SELECT @PREVIOUSWTAX= COALESCE(Sum(WTAX),0) from payroll_summary WHERE Employee_id = @idemployeewtax  and Date_End= @previouscuttoffwtax  --Previous wtax   				 			  			  
	
		set @TOTALMANDATORIESPREVIOUS  = COALESCE(@ssseegrossprevious,0)+COALESCE(@previousphiee,0)+COALESCE(@previouspagee,0)+COALESCE(@prossseegrossprevious,0)
		SET @TOTALMANDATORIES	= COALESCE(@ssseegrossfinal2,0)+COALESCE(@phieebasic2,0)+COALESCE(@pageebasic,0)+COALESCE(@prossseegrossfinal3,0)

		if @wtaxbasis ='gross'
		SET @TOTALGROSS = @forssstotalgrossprevious+@grossamt
		if @wtaxbasis  ='basic'
		SET @TOTALGROSS = @forssstotalbasicprevious+@basicamt
		


		SET @TAXABLEINCOME = (CAST(@TOTALGROSS AS FLOAT))-(cAST(@TOTALMANDATORIES AS FLOAT)+cAST(@TOTALMANDATORIESPREVIOUS AS FLOAT))
 
	
	
	
		SELECT TOP 1  @TAXCOMPENSATIONLEVEL =  compensationlevel FROM TAXTABLENEW where Term = 'Monthly' and Range1 <= @TAXABLEINCOME order by Series desc
		SELECT TOP 1  @TAXPERCENT =  Percentage  FROM TAXTABLENEW where Term = 'Monthly' and Range1 <= @TAXABLEINCOME order by Series desc
		SELECT TOP 1  @TAXPRESCRIBE =  PrescribeTax  FROM TAXTABLENEW where Term = 'Monthly' and Range1 <= @TAXABLEINCOME order by Series desc


		SET @TAXOVER  = @TAXABLEINCOME - @TAXCOMPENSATIONLEVEL
	
		SET @WTAXCOMPENSATION = @TAXOVER * @TAXPERCENT
	
		SET @WTAXCOMPENSATIONFINAL  = @TAXPRESCRIBE
		SET @WTAXCOMPENSATIONFINAL  =(@WTAXCOMPENSATION +@TAXPRESCRIBE)-@PREVIOUSWTAX
		
		--SET @WTAXCOMPENSATIONFINAL  =@TOTALMANDATORIES
	


		FETCH NEXT FROM myCursor7 INTO @idemployeewtax
	END
	CLOSE myCursor7
	DEALLOCATE myCursor7


-----------------------------End of Tax--------------------------------------------------

/*



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
     
	SELECT employee_id,idotherdeduction FROM otherdeduction where idclientdeduction = @idclient and Date_Start= @PayrollPeriodStart  and iddepartmentdeduction = @idDepartment AND employee_id = @idemployee order by idotherdeduction
	  
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
     
	SELECT idpayrollsum,Employee_id FROM payroll_summary where idclientp = @idclient and Date_Start= @PayrollPeriodStart  and department_codep = @idDepartment AND employee_id = @idemployee order by idpayrollsum
	  
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
                               HAVING         (COUNT(*) > 1) AND (Date_Start = @PayrollPeriodStart) AND (idclientp = @idclient) AND (Employee_id = @idemployee))) AND (idclientp = @idclient) AND (Date_Start = @PayrollPeriodStart)
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
			
		--	UPDATE payroll_summary SET netamount=@TNetamountdouble ,netamount2=  @TNetamount2double   WHERE idpayrollsum= @Tidpayrollsumdouble 
			--update dups tag as 1 mean color red, its an idicator shows in payroll summary form
		--	update payroll_summary SET dupstag = 1 WHERE idpayrollsum= @Tidpayrollsumdouble

		print'x'

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
*/

--select [sssemployee] = @finalssseegross2,[sssemployer]=@finalsssergross2,[sssecc]= @finalssseccgross2,[Philhealthee] = @phieebasic2,[pagibigee] = @pageebasic

select [sssemployee] = @ssseefinal3,[sssemployer]=@ssserfinal3,[sssecc]= @sssECCfinal3,[prosssemployee]= @prossseegrossfinal3,[prosssemployer]=@prosssergrossfinal3,[Philhealthee]= @phieebasic2,[pagibigee] = @pageebasic,[sssprevious] =@forssstotalgrossprevious,[phiprevious] = @forphitotalbasicprevious, [wtaxcompensationfinal] = @WTAXCOMPENSATIONFINAL

--use below script to test the value computed by script above  
--DECLARE @idemployee int =2229
--DECLARE @idclient int =17
--declare @idDepartment int = 17
--DECLARE @PayrollPeriodStart date = '2023-04-01'
--DECLARE @idclientbranch int =17
--DECLARE @grossamt float = 10000
--DECLARE @basicamt float = 11000
--DECLARE @UserName varchar(20)= 'pat'
--execute [42bf00bd-6230-462f-a118-a3d93166c3b9V215IND] @idemployee,@idclient,@idDepartment, @PayrollPeriodStart,@idclientbranch,@grossamt,@basicamt,@UserName


END
