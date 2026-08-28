
CREATE PROCEDURE [dbo].[42bf00bd-6230-462f-a118-a3d93166c3b9V230INDWEEKLYSSS]

@idemployee INT,
@idclient varchar(20),
@idDepartment INT,
@PayrollPeriodStart Date,
@idclientbranch INT,
@grossamt float,
@basicamt float,
@UserName varchar(20),
@withsss bit,
@withssspro bit,
@withphi bit,
@withpag bit,
@idpayroll int,
@payrollmonth nvarchar(20)

AS
BEGIN

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
DECLARE @ssserbasicprevious as float 

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
				
				SELECT TOP 1  @idpayrollsum2 =  idpayrollsum FROM payroll_summary where Employee_id = @idemployeesss and idclientp = @idclient and Date_Start= @PayrollPeriodStart  order by idpayrollsum desc
				--count trx
				SELECT @countempidsss =  COUNT(Employee_id) FROM  payroll_summary where Employee_id = @idemployeesss and idclientp = @idclient and payrollmonth= @payrollmonth 
				
				--previous
				SELECT @forssstotalgrossprevious= COALESCE(Sum(grossamttaxable),0) from payroll_summary WHERE Employee_id = @idemployeesss and idclientp = @idclient  and  payrollmonth= @payrollmonth and idpayrollsum<@idpayroll  
				SELECT @forssstotalbasicprevious= COALESCE(Sum(basic),0) from payroll_summary WHERE Employee_id = @idemployeesss and idclientp = @idclient  and  payrollmonth= @payrollmonth and idpayrollsum<@idpayroll  
				

				--current view
				SELECT @forssstotalgross= COALESCE(Sum(grossamttaxable),0) from payroll_summary WHERE Employee_id = @idemployeesss and idclientp = @idclient  and  idclientp = @idclient and payrollmonth= @payrollmonth  and  idpayrollsum = @idpayroll -- gross exluded current trx
				SELECT @forssstotalbasic= COALESCE(Sum(basic),0) from payroll_summary WHERE Employee_id = @idemployeesss and  idclientp = @idclient and payrollmonth= @payrollmonth and idpayrollsum = @idpayroll	 -- basic exluded current trx

				
				
				--SELECT @forsssgrandtotalgross1 = @grossamt+@forssstotalgross
				--SELECT @forsssgrandtotalbasic1 = @basicamt+@forssstotalbasic

				--SELECT @forsssgrandtotalgross = @grossamt+@forssstotalgross+@forssstotalgrossprevious				
				--SELECT @forsssgrandtotalbasic = @basicamt+@forssstotalbasic+@forssstotalbasicprevious

				SELECT @forsssgrandtotalgross = @grossamt+@forssstotalgrossprevious				
				SELECT @forsssgrandtotalbasic = @basicamt+@forssstotalbasicprevious
										
				
		
				SELECT @ssseegrossprevious = COALESCE(Sum(contributionSSSEE),0) from payroll_summary WHERE Employee_id = @idemployeesss and idclientp = @idclient  and  payrollmonth= @payrollmonth and idpayrollsum <@idpayroll
				SELECT @ssseebasicprevious = COALESCE(Sum(contributionSSSEE),0) from payroll_summary WHERE Employee_id = @idemployeesss and idclientp = @idclient  and  payrollmonth= @payrollmonth and idpayrollsum <@idpayroll

				SELECT @sssERgrossprevious = COALESCE(Sum(contributionSSSER),0) from payroll_summary WHERE Employee_id = @idemployeesss and idclientp = @idclient  and  payrollmonth= @payrollmonth and idpayrollsum <@idpayroll
				SELECT @sssERbasicprevious = COALESCE(Sum(contributionSSSER),0) from payroll_summary WHERE Employee_id = @idemployeesss and idclientp = @idclient  and  payrollmonth= @payrollmonth and idpayrollsum <@idpayroll

				
		
				SELECT TOP 1  @ssseegross = EmployeeSSS FROM SSS where Range <= @forsssgrandtotalgross order by Range desc
				SELECT TOP 1  @ssseebasic = EmployeeSSS FROM SSS where Range <= @forsssgrandtotalbasic order by Range desc

				SELECT TOP 1  @sssERgross = EmployerSSS FROM SSS where Range <= @forsssgrandtotalgross order by Range desc
				SELECT TOP 1  @sssERbasic = EmployerSSS FROM SSS where Range <= @forsssgrandtotalbasic order by Range desc



				
				--- below is the final computation of sss SSS EMPLOYEE
				SELECT @ssseegrossfinal = CAST(@ssseegross as float)- cast(@ssseegrossprevious as float)
				SELECT @ssseebasicfinal = CAST(@ssseebasic as float)- cast(@ssseebasicprevious as float)
												
					
				--- below is the final computation of sss SSS EMPLOYER					
					
				SELECT @sssERgrossfinal = CAST(@sssERgross as float)-cast(@sssERgrossprevious as float)
				SELECT @sssERbasicfinal = CAST(@sssERbasic as float)-cast(@sssERbasicprevious as float)
													
				
				--ecc
				--SELECT @sssECCgrossprevious = COALESCE(Sum(contributionSSSECC),0) from payroll_summary WHERE Employee_id = @idemployeesss and  idclientp = @idclient and Date_End= @previouscuttoff
				SELECT @sssECCgrossprevious = COALESCE(Sum(contributionSSSECC),0) from payroll_summary WHERE Employee_id = @idemployeesss and idclientp = @idclient  and  payrollmonth= @payrollmonth and idpayrollsum <@idpayroll
				SELECT @sssECCbasicprevious = COALESCE(Sum(contributionSSSECC),0) from payroll_summary WHERE Employee_id = @idemployeesss and idclientp = @idclient  and  payrollmonth= @payrollmonth and idpayrollsum <@idpayroll
				

				SELECT TOP 1  @eccgross = EmployerECC FROM SSS where Range <= @forsssgrandtotalgross order by Range desc
				SELECT TOP 1  @eccbasic = EmployerECC FROM SSS where Range <= @forsssgrandtotalbasic order by Range desc
				
				--below is the computation of ECC 
				SELECT @sssECCgrossfinal = cast(@eccgross as float)- CAST(@sssECCgrossprevious as float)
				SELECT @sssECCbasicfinal = cast(@eccbasic as float)- CAST(@sssECCbasicprevious as float)
				
				--SELECT TOP 1  @eccgross2 = EmployerECC FROM SSS where Range <= @forssstotalgross order by Range desc --- for ecom case 


					
			if @sssbasis = 'Gross' AND @countempidsss =1  and @withsss=1 
		  		
			Begin
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
			

			
				SET @ssseefinal3 = @ssseegrossfinal2
				SET @ssserfinal3 = @sssergrossfinal2
				SET @sssECCfinal3 = @sssECCgrossfinal2
			End
			
			
			if @sssbasis = 'Gross' and @countempidsss >1  and  @withsss =1
		  	BEgin	

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
			

				SET @ssseefinal3 = @ssseegrossfinal2
				SET @ssserfinal3 = @sssergrossfinal2
				SET @sssECCfinal3 = @sssECCgrossfinal2
								
			End	
							   									   					 				  				  				 
			if @sssbasis = 'basic' and @countempidsss =1 and @withsss=1 
			Begin

			--EMPLOYEEE BASIC PROCESS		
				Set @ssseebasicfinal2 =
					CASE 
						WHEN @forsssgrandtotalbasic <=1000.00 THEN 0
						WHEN @forsssgrandtotalbasic >1000.00 THEN @ssseebasicfinal
					END
				Set @ssserbasicfinal2 =
					CASE 
						WHEN @forsssgrandtotalbasic <=1000.00 THEN 0
						WHEN @forsssgrandtotalbasic >1000.00 THEN @ssserbasicfinal
					END
				Set @sssECCbasicfinal2 =
					 
					CASE 
						WHEN @forsssgrandtotalbasic <=1000 THEN 0
						WHEN @forsssgrandtotalbasic >1000 THEN @sssECCbasicfinal
					END
			
				SET @ssseefinal3 = @ssseebasicfinal2
				SET @ssserfinal3 = @ssserbasicfinal2  			
				SET @sssECCfinal3 = @sssECCbasicfinal2								
			
			End 
			
			If @sssbasis = 'basic' and @countempidsss >1 and @withsss=1 --if more than 2 records basic reference
		  	BEgin	
			

			--EMPLOYEEE BASIC PROCESS		
				Set @ssseebasicfinal2 =
					CASE 
						WHEN @forsssgrandtotalbasic <=1000.00 THEN 0
						WHEN @forsssgrandtotalbasic >1000.00 THEN @ssseebasicfinal
						
					END
				Set @ssserbasicfinal2 =
					CASE 
						WHEN @forsssgrandtotalbasic <=1000.00 THEN 0
						WHEN @forsssgrandtotalbasic >1000.00 THEN @ssserbasicfinal
					END
				Set @sssECCbasicfinal2 =
					 
					CASE 
						WHEN @forsssgrandtotalbasic <=1000 THEN 0
						WHEN @forsssgrandtotalbasic >1000 THEN @sssECCbasicfinal
					END
							

				SET @ssseefinal3 = @ssseebasicfinal2
				SET @ssserfinal3 = @ssserbasicfinal2
				SET @sssECCfinal3 = @sssECCbasicfinal2
			End 
						

			

	FETCH NEXT FROM myCursor2 INTO @idemployeesss,@sssbasis
	END
	CLOSE myCursor2
	DEALLOCATE myCursor2
	---------------------------------------------------End SSS PRocess -------------------------------------------------------------------------

select [sssemployee] = @ssseefinal3,[sssemployer]=@ssserfinal3,[sssecc]= @sssECCfinal3



END
