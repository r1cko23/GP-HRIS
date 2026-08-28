
CREATE PROCEDURE [dbo].[42bf00bd-6230-462f-a118-a3d93166c3b9V230INDWEEKLYSSSPROMASS]

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



	---------------------------------------------------Start SSS Pro PRocess -------------------------------------------------------------------------


declare @procurrentday INT
declare @procut2start INT
DECLARE @idpayrollsum2 INT
declare @proidemployeesss int
declare @procounter int = 0
declare @prosssbasis varchar(7)
DECLARE @proidpayrollsum2 varchar(20)
DECLARE @idemployeesss INT

 
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
DECLARE @prossserbasicfinal2 AS FLOAT

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
				
				SELECT TOP 1  @idpayrollsum2 =  idpayrollsum FROM payroll_summary where Employee_id = @proidemployeesss and idclientp = @idclient and Date_Start= @PayrollPeriodStart   order by idpayrollsum desc
				--count trx
				SELECT @procountempidsss =  COUNT(Employee_id) FROM  payroll_summary where Employee_id = @proidemployeesss and idclientp = @idclient and payrollmonth= @payrollmonth 
				

					--PREVIOUS
				SELECT @proforssstotalgrossprevious= COALESCE(Sum(grossamttaxable),0) from payroll_summary WHERE Employee_id = @proidemployeesss and idclientp = @idclient  and  payrollmonth= @payrollmonth and idpayrollsum<@idpayroll  
				SELECT @proforssstotalbasicprevious= COALESCE(Sum(basic),0) from payroll_summary WHERE Employee_id = @proidemployeesss and idclientp = @idclient  and payrollmonth= @payrollmonth and idpayrollsum<@idpayroll 
				
					--current view
				SELECT @proforssstotalgross =COALESCE(SUM(grossamttaxable),0)FROM payroll_summary WHERE Employee_id = @proidemployeesss AND idclientp = @idclient AND payrollmonth = @payrollmonth AND idpayrollsum = @idpayroll
				SELECT @proforssstotalbasic= COALESCE(Sum(basic),0) from payroll_summary WHERE Employee_id = @proidemployeesss and  idclientp = @idclient  and payrollmonth= @payrollmonth  and  idpayrollsum = @idpayroll 
						 						 			

				SELECT @proforsssgrandtotalgross = @grossamt+@proforssstotalgrossprevious
				SELECT @proforsssgrandtotalbasic = @basicamt+@proforssstotalbasicprevious
									

				--EE gross PRO
				SELECT @prossseegrossprevious = COALESCE(Sum(contributionSSSEEpro),0) from payroll_summary WHERE Employee_id = @proidemployeesss and idclientp = @idclient  and  payrollmonth= @payrollmonth and idpayrollsum <@idpayroll
				SELECT TOP 1  @prossseegross = eepro FROM SSS where Range <= @proforsssgrandtotalgross order by Range desc
				
				--- below is the final computation of sss SSS EMPLOYEE
				SELECT @prossseegrossfinal = CAST(@prossseegross as float)- cast(@prossseegrossprevious as float)
			
								
				--ER gross PRO			   				
				SELECT @prosssERgrossprevious = COALESCE(Sum(contributionSSSERpro),0) from payroll_summary WHERE Employee_id = @proidemployeesss and idclientp = @idclient  and  payrollmonth= @payrollmonth and idpayrollsum <@idpayroll
				SELECT TOP 1  @prosssERgross = erpro FROM SSS where Range <= @proforsssgrandtotalgross order by Range desc
				--below is the final computation if SSS employer 
				SELECT @prosssERgrossfinal = CAST(@prosssERgross as float)- cast(@prosssergrossprevious as float)
			
					  -------BASIC
				-- SSS basic option
				SELECT @prossseebasicprevious = COALESCE(Sum(contributionSSSEEpro),0) from payroll_summary WHERE Employee_id = @idemployee and idclientp = @idclient  and  payrollmonth= @payrollmonth and idpayrollsum <@idpayroll
				SELECT TOP 1  @prossseebasic = eepro FROM SSS where Range <= @proforsssgrandtotalbasic order by Range desc
				
				--- below is the final computation of sss SSS EMPLOYEE basic
				SELECT @prossseebasicfinal = CAST(@prossseebasic as float)- cast(@prossseeBASICprevious as float)
				
				SELECT @prossserbasicprevious = COALESCE(Sum(contributionSSSERpro),0) from payroll_summary WHERE Employee_id = @idemployee and idclientp = @idclient  and   payrollmonth= @payrollmonth and idpayrollsum <@idpayroll
				SELECT TOP 1  @prossserbasic = erpro FROM SSS where Range <= @proforsssgrandtotalbasic order by Range desc
				SELECT @prossserbasicfinal = CAST(@prossserbasic as float)- cast(@prossseeBASICprevious as float)
				-- END SSS basic option		
		
		


				 
												
			if @prosssbasis = 'Gross' AND @procountempidsss =1 and @withssspro=1 
		  	Begin
								 			
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
					

				SET @prossseegrossfinal3 = @prossseegrossfinal2
				SET @prosssergrossfinal3 = @prosssergrossfinal2
				
			End

			 if @prosssbasis = 'Gross' and @procountempidsss >1  and @withssspro=1
		  	BEgin

			
				--------EMPLOYEEE GROSS PROCESS		
				Set @prossseegrossfinal2 =
				
							CASE 
								WHEN @proforsssgrandtotalgross <=2000.00 THEN 0
								WHEN @proforsssgrandtotalgross >2000.00 THEN @prosssEEgrossfinal
								--@
							END
				

				--------EMPLOYEER GROSS PROCESS		
				Set @prosssergrossfinal2 =
					CASE 
						WHEN @proforsssgrandtotalgross <=2000 THEN 0
						WHEN @proforsssgrandtotalgross >2000 THEN @prosssERgrossfinal
					END
			
				
				SET @prossseegrossfinal3 = @prossseegrossfinal2
				SET @prosssergrossfinal3 = @prosssergrossfinal2
			End 
			



--SET basic prOCESS---------------------------------------------------------

		



			if @prosssbasis = 'basic' AND @procountempidsss =1 and @withssspro=1 
		  	Begin

				--EEbasic
				Set @prossseebasicfinal2 =
							CASE 
								WHEN @proforsssgrandtotalbasic <=2000.00 THEN 0
								WHEN @proforsssgrandtotalbasic >2000.00 THEN @prosssEEbasicfinal
							END
				
				---ERbasic
				Set @prossserbasicfinal2 =
					CASE 
						WHEN @proforsssgrandtotalbasic <=2000 THEN 0
						WHEN @proforsssgrandtotalbasic >2000 THEN @prosssERbasicfinal
					END

				SET @prossseegrossfinal3 = @prossseebasicfinal2
				SET @prosssergrossfinal3 = @prossserbasicfinal2
				
			End
			
			if @prosssbasis = 'basic' and @procountempidsss >1 and @withssspro=1 
		  	BEgin

				Set @prossseebasicfinal2 =
							CASE 
								WHEN @proforsssgrandtotalbasic <=2000.00 THEN 0
								WHEN @proforsssgrandtotalbasic >2000.00 THEN @prosssEEbasicfinal
							END
				

				--------EMPLOYEER GROSS PROCESS		
				Set @prossserbasicfinal2 =
					CASE 
						WHEN @proforsssgrandtotalbasic <=2000 THEN 0
						WHEN @proforsssgrandtotalbasic >2000 THEN @prosssERbasicfinal
					END
				
				SET @prossseegrossfinal3 = @prossseebasicfinal2
				SET @prosssergrossfinal3 = @prossserbasicfinal2
			End 
	
	
	
	FETCH NEXT FROM myCursor8 INTO @proidemployeesss,@prosssbasis
	END
	CLOSE myCursor8
	DEALLOCATE myCursor8


	---------------------------------------------------End SSS Pro PRocess -------------------------------------------------------------------------

 
BEGIN TRY
    BEGIN TRANSACTION;

    UPDATE payroll_summary
    SET
        contributionSSSEEpro = @prossseegrossfinal3,
        contributionSSSERpro = @prosssergrossfinal3
    WHERE idpayrollsum = @idpayroll;

    COMMIT TRANSACTION;
END TRY
BEGIN CATCH
    IF @@TRANCOUNT > 0
        ROLLBACK TRANSACTION;

    THROW;
END CATCH;

--select [prosssemployee]= @prossseegrossfinal3,[prosssemployer]=@prosssergrossfinal3

END
