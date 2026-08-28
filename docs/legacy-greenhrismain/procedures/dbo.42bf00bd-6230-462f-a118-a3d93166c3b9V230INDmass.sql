
CREATE PROCEDURE [dbo].[42bf00bd-6230-462f-a118-a3d93166c3b9V230INDmass]

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
FROM payroll_summary where idclientp = @idclient and Date_Start=@PayrollPeriodStart order by idpayrollsum
OPEN myCursor0
   
   FETCH NEXT FROM myCursor0 INTO @idpayroll0,@idemployee0,@sssbasis0,@grossamt0,@basicamt0,@otherbasisamt0,@withsss,@withssspro,@withphi,@withpag,@monthlysalary,@otherbasisamt0,@fixrate0
	WHILE @@FETCH_STATUS = 0
	
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
DECLARE @forssstotalbasic float
DECLARE @forssstotalotherbasis float




DECLARE @forssstotalgrossprevious as float
DECLARE @forssstotalbasicprevious FLOAT
DECLARE @forssstotalotherbasisprevious FLOAT


DECLARE @forsssgrandtotalgross float
DECLARE @forsssgrandtotalbasic float
DECLARE @forsssgrandtotalotherbasis float


DECLARE @forsssgrandtotalgross1 float
DECLARE @forsssgrandtotalbasic1 FLOAT
DECLARE @forsssgrandtotalotherbasis1 FLOAT


DECLARE @ssseeprevious as float	--store previous cuttof store 


DECLARE @ssseegross as float			--store get the value of sss current cuttoff
DECLARE @ssseebasic as float
DECLARE @ssseeotherbasis as float

DECLARE @sssergross as float
DECLARE @ssserbasic as float
DECLARE @ssserotherbasis as float

DECLARE @eccgross as float
DECLARE @eccbasic as float
DECLARE @eccotherbasis as float

DECLARE @ssseegrossfinal as float		--store both previous and current value SSS
DECLARE @ssseebasicfinal as float
DECLARE @ssseeotherbasisfinal as float

DECLARE @sssergrossfinal as float	
DECLARE @ssserbasicfinal float
DECLARE @ssserotherbasisfinal float

DECLARE @sssECCgrossfinal AS FLOAT
DECLARE @sssECCbasicfinal AS FLOAT
DECLARE @sssECCotherbasisfinal AS FLOAT

DECLARE @ssseegrossfinal2 AS FLOAT		--store the value of sss depends on the condition fall
DECLARE @ssseebasicfinal2 float
DECLARE @ssseeotherbasisfinal2 float


DECLARE @ssseegross2 float				--used it for e-com case value soon to be remove 
DECLARE @ssseebasic2 float
DECLARE @ssseeotherbasis2 float


DECLARE @ssserprevious as float



DECLARE @sssergrossfinal2 as float
DECLARE @ssserbasicfinal2 float
DECLARE @ssserotherbasisfinal2 float

DECLARE @sssECCgrossfinal2 as float
DECLARE @sssECCbasicfinal2 as float
DECLARE @sssECCotherbasisfinal2 as float

DECLARE @sssergross2 float 
DECLARE @ssserbasic2 FLOAT
DECLARE @ssserothebasis2 FLOAT

DECLARE @ssseefinal3 AS FLOAT		    --store the sssgross final2
DECLARE @ssserfinal3 as float

DECLARE @sssECCfinal3 as float

DECLARE @sssECCprevious AS FLOAT

DECLARE @forsssgrandtotalotherbasis2 float

DECLARE @ssseeotherentry float
DECLARE @ssserotherentry float
DECLARE @sssECCotherentry float


DECLARE @countempidsss int


--DECLARE @PayrollPeriodStart1 VARCHAR(20) = '2023-04-16'
declare @previouscuttoff as date
SET @previouscuttoff = DATEADD(DAY, -1, @PayrollPeriodStart)

  
DECLARE myCursor2 CURSOR FOR
-- open payroll summary      

SELECT employee_id,sssbasis FROM payroll_summary where idclientp = @idclient and Date_Start=@PayrollPeriodStart  AND employee_id = @idemployee0  order by idpayrollsum
 
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
				SELECT @forssstotalotherbasisprevious= COALESCE(Sum(othermandatorybasis),0) from payroll_summary WHERE Employee_id = @idemployeesss and  Date_End= @previouscuttoff  
				
				SELECT @forssstotalgross= COALESCE(Sum(grossamttaxable),0) from payroll_summary WHERE Employee_id = @idemployeesss and  idclientp = @idclient and Date_Start= @PayrollPeriodStart  and  idpayrollsum < @idpayroll0
				SELECT @forssstotalbasic= COALESCE(Sum(basic),0) from payroll_summary WHERE Employee_id = @idemployeesss and  idclientp = @idclient and Date_Start= @PayrollPeriodStart and  idpayrollsum < @idpayroll0
				SELECT @forssstotalotherbasis= COALESCE(Sum(othermandatorybasis),0) from payroll_summary WHERE Employee_id = @idemployeesss and  idclientp = @idclient and Date_Start= @PayrollPeriodStart and  idpayrollsum < @idpayroll0
										
				--SELECT @forsssgrandtotalgross1 = @grossamt+@forssstotalgross
				--SELECT @forsssgrandtotalbasic1 = @basicamt+@forssstotalbasic
				
				--OTHER BASIS CONDITION
				SELECT @forsssgrandtotalotherbasis1 = (@otherbasisamt0 + @forssstotalotherbasis + @forssstotalotherbasisprevious)
				-- this condition set if otherbasis is greater than monthly salay then use monthly salary as reference to compare to sss table 
				SET @forsssgrandtotalotherbasis2 = 
					CASE 
						WHEN @forsssgrandtotalotherbasis1>@monthlysalary THEN @monthlysalary
						else
						@forsssgrandtotalotherbasis1
					END;
				

				SELECT @forsssgrandtotalgross = @grossamt0+@forssstotalgross+@forssstotalgrossprevious				
				SELECT @forsssgrandtotalbasic = @basicamt0+@forssstotalbasic+@forssstotalbasicprevious
				SELECT @forsssgrandtotalotherbasis = @forsssgrandtotalotherbasis2
				
				
				--ee previous		
				SELECT @ssseeprevious = COALESCE(Sum(contributionSSSEE),0) from payroll_summary WHERE Employee_id = @idemployeesss and  Date_End= @previouscuttoff
			
				--er previous
				SELECT @ssserprevious = COALESCE(Sum(contributionSSSER),0) from payroll_summary WHERE Employee_id = @idemployeesss and Date_End= @previouscuttoff
			
				--ecc previous
				SELECT @sssECCprevious = COALESCE(Sum(contributionSSSECC),0) from payroll_summary WHERE Employee_id = @idemployeesss and Date_End= @previouscuttoff




			

				--ee othertrx		
				SELECT @ssseeotherentry = COALESCE(Sum(contributionSSSEE),0) from payroll_summary WHERE Employee_id = @idemployeesss and  Date_Start= @PayrollPeriodStart and idpayrollsum < @idpayroll0
			
				--er othertrx
				SELECT @ssserotherentry = COALESCE(Sum(contributionSSSER),0) from payroll_summary WHERE Employee_id = @idemployeesss and Date_Start= @PayrollPeriodStart and idpayrollsum < @idpayroll0
				
				--ecc othertrx
				SELECT @sssECCotherentry = COALESCE(Sum(contributionSSSECC),0) from payroll_summary WHERE Employee_id = @idemployeesss and Date_Start= @PayrollPeriodStart  and idpayrollsum < @idpayroll0
				
		
				SELECT TOP 1  @ssseegross = EmployeeSSS FROM SSS where Range <= @forsssgrandtotalgross order by Range desc
				SELECT TOP 1  @ssseebasic = EmployeeSSS FROM SSS where Range <= @forsssgrandtotalbasic order by Range desc
				SELECT TOP 1  @ssseeotherbasis = EmployeeSSS FROM SSS where Range <= @forsssgrandtotalotherbasis order by Range desc


				SELECT TOP 1  @sssergross = EmployerSSS FROM SSS where Range <= @forsssgrandtotalgross order by Range desc
				SELECT TOP 1  @ssserbasic = EmployerSSS FROM SSS where Range <= @forsssgrandtotalbasic order by Range desc
				SELECT TOP 1  @ssserotherbasis = EmployerSSS FROM SSS where Range <= @forsssgrandtotalotherbasis order by Range desc


				SELECT TOP 1  @eccgross = EmployerECC FROM SSS where Range <= @forsssgrandtotalgross order by Range desc
				SELECT TOP 1  @eccbasic = EmployerECC FROM SSS where Range <= @forsssgrandtotalbasic order by Range desc
				SELECT TOP 1  @eccotherbasis = EmployerECC FROM SSS where Range <= @forsssgrandtotalotherbasis order by Range desc
								
				--- below is the final computation of sss SSS EMPLOYEE
				SELECT @ssseegrossfinal = CAST(@ssseegross as float)- cast(@ssseeprevious as float)
				SELECT @ssseebasicfinal = CAST(@ssseebasic as float)- cast(@ssseeprevious as float)
				SELECT @ssseeotherbasisfinal = CAST(@ssseeotherbasis as float)- cast(@ssseeprevious as float)
																				
				--- below is the final computation of sss EMPLOYER					
				SELECT @sssergrossfinal = CAST(@sssERgross as float)-cast(@sssERprevious as float)
				SELECT @ssserbasicfinal = CAST(@ssserbasic as float)-cast(@sssERprevious as float)
				SELECT @ssserotherbasisfinal = CAST(@ssserotherbasis as float)-cast(@ssserprevious as float)							
			
				--below is the computation of ECC 
				SELECT @sssECCgrossfinal = cast(@eccgross as float)- CAST(@sssECCprevious as float)
				SELECT @sssECCbasicfinal = cast(@eccbasic as float)- CAST(@sssECCprevious as float)
				SELECT @sssECCotherbasisfinal = cast(@eccotherbasis as float)- CAST(@sssECCprevious as float)
									
									
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
				Set @sssECCgrossfinal2 =
					CASE 
						WHEN @forsssgrandtotalgross <=2000 THEN 0
						WHEN @forsssgrandtotalgross >2000 THEN @sssECCgrossfinal
					END
			
			


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



					--EMPLOYEEE OTHER BASIS PROCESS		
				Set @ssseeotherbasisfinal2 =
					CASE 
						WHEN @forsssgrandtotalotherbasis1 <=1000.00 THEN 0
						WHEN @forsssgrandtotalotherbasis1 >1000.00 THEN @ssseeotherbasisfinal
					END
				Set @ssserotherbasisfinal2 =
					CASE 
						WHEN @forsssgrandtotalotherbasis1 <=1000.00 THEN 0
						WHEN @forsssgrandtotalotherbasis1 >1000.00 THEN @ssserotherbasisfinal
					END
				Set @sssECCotherbasisfinal2 =
					 
					CASE 
						WHEN @forsssgrandtotalotherbasis1 <=1000 THEN 0
						WHEN @forsssgrandtotalotherbasis1 >1000 THEN @sssECCotherbasisfinal
					END
						

		
					
			if @sssbasis = 'gross' AND @countempidsss =1  and @withsss='Y'  	
			Begin
				--update payroll_summary set contributionSSSEE = @ssseegrossfinal2,contributionSSSER=@sssergrossfinal2,contributionSSSECC =@sssECCgrossfinal2 where idpayrollsum=@idpayrollsum2
				--Print 'Gross'
				SET @ssseefinal3 = @ssseegrossfinal2
				SET @ssserfinal3 = @sssergrossfinal2
				SET @sssECCfinal3 = @sssECCgrossfinal2
			End
			
			if @sssbasis = 'gross' AND @countempidsss =1  and @withsss='N' 		
			Begin
				--update payroll_summary set contributionSSSEE = @ssseegrossfinal2,contributionSSSER=@sssergrossfinal2,contributionSSSECC =@sssECCgrossfinal2 where idpayrollsum=@idpayrollsum2
				--Print 'Gross'
				SET @ssseefinal3 = 0
				SET @ssserfinal3 = 0
				SET @sssECCfinal3 = 0
			End
			
			if @sssbasis = 'gross' and @countempidsss >1  and  @withsss='Y'  
			BEgin	
				SET @ssseefinal3 = cast(@ssseegrossfinal2 as float)-cast(@ssseeotherentry as float)
				SET @ssserfinal3 = cast(@sssergrossfinal2 as float)-cast(@ssserotherentry as float)
				SET @sssECCfinal3 =cast(@sssECCgrossfinal2 as float)-cast(@sssECCotherentry as float) 

				--update payroll_summary set contributionSSSEE = @ssseefinal3,contributionSSSER=@ssserfinal3,contributionSSSECC=@sssECCfinal3 where idpayrollsum=@idpayroll0 and  Employee_id = @idemployeesss and idclientp = @idclient and Date_Start= @PayrollPeriodStart
				--update other sssee to zero 
				--update payroll_summary set contributionSSSEE =0,contributionSSSER=0,contributionSSSECC =0 where idpayrollsum<>@idpayrollsum2 and  Employee_id = @idemployeesss and idclientp = @idclient and Employee_id = @idemployeesss and Date_Start= @PayrollPeriodStart
			End 

							   									   					 				  				  				 
			if @sssbasis = 'basic' and @countempidsss =1  and @withsss='Y'  
			Begin
				SET @ssseefinal3 = @ssseebasicfinal2
				SET @ssserfinal3 = @ssserbasicfinal2
				--SET @ssserfinal3 = 123456
				SET @sssECCfinal3 = @sssECCbasicfinal2								
				--update payroll_summary set contributionSSSEE = @ssseefinal3,contributionSSSER=@ssserfinal3,contributionSSSECC=@sssECCfinal3 where idpayrollsum=@idpayroll0 and  Employee_id = @idemployeesss and idclientp = @idclient and Date_Start= @PayrollPeriodStart
				
				--update payroll_summary set contributionSSSEE = @ssseebasic,contributionSSSER=@ssserbasic,contributionSSSECC =@eccbasic where idpayrollsum=@idpayrollsum2
			End 
			
			if @sssbasis = 'basic' and @countempidsss >1  and @withsss='Y'  --if more than 2 records basic reference
		  	BEgin		
				SET @ssseefinal3 = cast(@ssseebasicfinal2 as float)-cast(@ssseeotherentry as float)
				SET @ssserfinal3 = cast(@ssserbasicfinal2 as float)-cast(@ssserotherentry as float)
				SET @sssECCfinal3 =cast(@sssECCbasicfinal2 as float)-cast(@sssECCotherentry as float)  
			End 	
			

			IF @sssbasis = 'others' AND @countempidsss = 1 AND @withsss = 'Y'  and @idclient <> 44
			BEGIN
				SET @ssseefinal3 = @ssseeotherbasisfinal2
				SET @ssserfinal3 = @ssserotherbasisfinal2
				SET @sssECCfinal3 = @sssECCotherbasisfinal2
			END  
			
			IF @sssbasis = 'others' AND @countempidsss > 1 AND @withsss = 'Y'  and @idclient <> 44
			BEGIN  
			    SET @ssseefinal3= @ssseeotherbasisfinal2
				SET @ssserfinal3=@ssserotherbasisfinal2
				SET @sssECCfinal3=@ssserotherbasisfinal2
			END  


			IF @sssbasis = 'others' AND @countempidsss =1 AND @withsss = 'Y'  and @idclient = 44
			BEGIN
				SET @ssseefinal3 = @ssseeotherbasisfinal2
				SET @ssserfinal3 = @ssserotherbasisfinal2
				SET @sssECCfinal3 = @sssECCotherbasisfinal2
			END  
			
			IF @sssbasis = 'others' AND @countempidsss > 1 AND @withsss = 'Y'  and @idclient = 44
			BEGIN  
			   -- SET @ssseefinal3 = cast(@ssseeotherentry as float)  cast(@ssseeotherbasisfinal2 as float) 
			    SET @ssseefinal3 = cast(@ssseeotherbasisfinal2 as float) - cast(@ssseeotherentry as float)
				SET @ssserfinal3 = cast(@ssserotherbasisfinal2 AS FLOAT) - cast(@ssserotherentry as float)
				SET @sssECCfinal3= cast(@sssECCotherbasisfinal2 as float)- cast(@sssECCotherentry as float)
			END
					   			 		



	FETCH NEXT FROM myCursor2 INTO @idemployeesss,@sssbasis
	END
	CLOSE myCursor2
	DEALLOCATE myCursor2

	update payroll_summary
	set contributionSSSEE =   @ssseefinal3,contributionSSSER =@ssserfinal3,contributionSSSECC=@sssECCfinal3
	where idpayrollsum = @idpayroll0		
	

	---------------------------------------------------End SSS PRocess -------------------------------------------------------------------------









 



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
				
				SELECT TOP 1  @idpayrollsum2 =  idpayrollsum FROM payroll_summary where Employee_id = @idemployeesss and idclientp = @idclient and Date_Start= @PayrollPeriodStart  order by grossalary desc
				--count trx
				SELECT @procountempidsss =  COUNT(Employee_id) FROM  payroll_summary where Employee_id = @idemployeesss and idclientp = @idclient and Date_Start= @PayrollPeriodStart
				
			 --previous cuttoff
			 --SELECT @proforssstotalgrossprevious= COALESCE(Sum(grossamttaxable),0) from payroll_summary WHERE Employee_id = @idemployeesss and  idclientp = @idclient and Date_End= @previouscuttoff  
				SELECT @proforssstotalgrossprevious= COALESCE(Sum(grossamttaxable),0) from payroll_summary WHERE Employee_id = @idemployeesss and Date_End= @previouscuttoff  
				SELECT @proforssstotalbasicprevious= COALESCE(Sum(basic),0) from payroll_summary WHERE Employee_id = @idemployeesss and Date_End= @previouscuttoff  
				SELECT @proforssstotalotherbasisprevious= COALESCE(Sum(othermandatorybasis),0) from payroll_summary WHERE Employee_id = @idemployeesss and Date_End= @previouscuttoff  
			
			--current cuttoff
				SELECT @proforssstotalgross= COALESCE(Sum(grossamttaxable),0) from payroll_summary WHERE Employee_id = @idemployeesss and  idclientp = @idclient and Date_Start= @PayrollPeriodStart  and  idpayrollsum < @idpayroll0
				SELECT @proforssstotalbasic= COALESCE(Sum(basic),0) from payroll_summary WHERE Employee_id = @idemployeesss and  idclientp = @idclient and Date_Start= @PayrollPeriodStart  and  idpayrollsum < @idpayroll0
				SELECT @proforssstotalotherbasis= COALESCE(Sum(othermandatorybasis),0) from payroll_summary WHERE Employee_id = @idemployeesss and  idclientp = @idclient and Date_Start= @PayrollPeriodStart  and  idpayrollsum < @idpayroll0
				
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


				SELECT @proforsssgrandtotalgross1 = @grossamt0+@proforssstotalgross
				SELECT @proforsssgrandtotalbasic1 = @basicamt0+@proforssstotalbasic
				SELECT @proforsssgrandtotalotherbasis1 = @otherbasisamt0+@proforssstotalotherbasis

				--SSSPRO PREVIOUS CUTTOFF
				SELECT @prossseeprevious = COALESCE(Sum(contributionSSSEEpro),0) from payroll_summary WHERE Employee_id = @idemployeesss and Date_End= @previouscuttoff
				SELECT @prossserprevious = COALESCE(Sum(contributionSSSERpro),0) from payroll_summary WHERE Employee_id = @idemployeesss  and Date_End= @previouscuttoff
								   				
				--sssproee othertrx		
				SELECT @prossseeotherentry = COALESCE(Sum(contributionSSSEEpro),0) from payroll_summary WHERE Employee_id = @idemployeesss and  Date_Start= @PayrollPeriodStart and idpayrollsum < @idpayroll0
		
				--sssproer othertrx
				SELECT @prossserotherentry = COALESCE(Sum(contributionSSSERpro),0) from payroll_summary WHERE Employee_id = @idemployeesss and Date_Start= @PayrollPeriodStart and idpayrollsum < @idpayroll0
				
				

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



												
			if @sssbasis = 'gross' AND @countempidsss =1 and @withssspro='Y' 
		  	Begin
				SET @prossseegrossfinal3 = @prossseegrossfinal2
				SET @prosssergrossfinal3 = @prosssergrossfinal2				
			End
			else if @sssbasis = 'gross' and @countempidsss >1  
		  	Begin 				
				SET @prossseegrossfinal3 = cast(@prossseegrossfinal2 as float) - cast(@prossseeotherentry as float)
				SET @prosssergrossfinal3 = cast(@prosssergrossfinal2 as float) - cast(@prossserotherentry as float)
				



			End 
			
			if @sssbasis = 'basic' AND @countempidsss =1 and @withssspro='Y' 
		  	Begin
				SET @prossseegrossfinal3 = @prossseebasicfinal2
				SET @prosssergrossfinal3 = @prossserbasicfinal2				
			End
			else if @sssbasis = 'basic' and @countempidsss >1  
		  	Begin
				SET @prossseegrossfinal3 = @prossseebasicfinal2
				SET @prosssergrossfinal3 = @prossserbasicfinal2			
			End 


			if @sssbasis = 'others' AND @countempidsss =1 and @withssspro='Y'  and @idclient <> 44
		  	Begin
				SET @prossseegrossfinal3 = @prossseeotherbasisfinal2
				SET @prosssergrossfinal3 = @prossserotherbasisfinal2				
			End
			else if @sssbasis = 'others' and @countempidsss >1  and @withssspro='Y'  and @idclient <> 44
		  	Begin
				SET @prossseegrossfinal3 = @prossseeotherbasisfinal2
				SET @prosssergrossfinal3 = @prossserotherbasisfinal2			
			End 


			if @sssbasis = 'others' AND @countempidsss =1 and @withssspro='Y'  and @idclient = 44
		  	Begin
				SET @prossseegrossfinal3 = @prossseeotherbasisfinal2
				SET @prosssergrossfinal3 = @prossserotherbasisfinal2				
			End
			else if @sssbasis = 'others' and @countempidsss >1  and @withssspro='Y'  and @idclient = 44
		  	Begin
				SET @prossseegrossfinal3 = cast(@prossseeotherbasisfinal2 as float) - cast(@prossseeotherentry as float)
				SET @prosssergrossfinal3 = cast(@prossserotherbasisfinal2 as float) - cast(@prossserotherentry as float)		
			End 



			
	FETCH NEXT FROM myCursor8 INTO @idemployeesss,@sssbasis
	END
	CLOSE myCursor8
	DEALLOCATE myCursor8



	update payroll_summary
	set contributionSSSEEpro = @prossseegrossfinal3
	  , contributionSSSERpro = @prosssergrossfinal3
	  , basicforsss =  @forssstotalgrossprevious --added by cdp for previous amount @proforssstotalgrossprevious
	where idpayrollsum = @idpayroll0		



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
DECLARE @forphitotalbasic float
DECLARE @forphitotalotherbasis float


declare @previousphiee as float 
declare @previousphier as float



declare @forphitotalgrossprevious as float
declare @forphitotalbasicprevious as float
declare @forphitotalotherbasisprevious as float

declare @forphigrandtotalgross as float
declare @forphigrandtotalbasic as float
declare @forphigrandtotalotherbasis as float

DECLARE @phipercentgross DECIMAL(5, 2)
DECLARE @phipercentbasic DECIMAL(5, 2)
DECLARE @phipercentotherbasis DECIMAL(5, 2)


DECLARE @phipercent2 DECIMAL(5, 2)
DECLARE @TDAYSPHI AS FLOAT


DECLARE @phiIDgross as int 
DECLARE @phiIDbasic as int
DECLARE @phiIDotherbasis as int

DECLARE @phieevaluegross1 as float
DECLARE @phieevaluebasic1 as float
DECLARE @phieevalueotherbasis1 as float

DECLARE @phiervaluegross1 as float
DECLARE @phiervaluebasic1 as float
DECLARE @phiervalueotherbasis1 as float

DECLARE @phieebasic AS FLOAT
DECLARE @phieegross AS FLOAT
DECLARE @phieeotherbasis AS FLOAT

DECLARE @phierbasic AS FLOAT
DECLARE @phiergross AS FLOAT
DECLARE @phierotherbasis AS FLOAT

DECLARE @forphigrandtotalotherbasis1 float
DECLARE @forphigrandtotalotherbasis2 float


DECLARE @phiee as float



DECLARE @phieevalue3 as float 

DECLARE @phieebasic2 AS FLOAT

DECLARE @phier as float


DECLARE @phierbasic2 AS FLOAT
DECLARE @countempidphi int
declare @philhealtheeotherentry float
declare @philhealtherotherentry	float


--DECLARE @PayrollPeriodStart1 VARCHAR(20) = '2023-04-16'
declare @previouscuttoffphi as date
SET @previouscuttoffphi = DATEADD(DAY, -1, @PayrollPeriodStart)
 
     
DECLARE myCursor3 CURSOR FOR
-- open payroll summary      

SELECT employee_id,philhealthbasis FROM payroll_summary where idclientp = @idclient and Date_Start=@PayrollPeriodStart  AND employee_id = @idemployee0  order by idpayrollsum
 
	OPEN myCursor3
   
   FETCH NEXT FROM myCursor3 INTO @idemployeephi,@phibasis
	WHILE @@FETCH_STATUS = 0
	
	BEGIN
				--	SET @pCounter = @pCounter + 1
				--- get the max idpayroll
			
				SELECT TOP 1  @phiidpayrollsum2 =  idpayrollsum FROM payroll_summary where Employee_id = @idemployeephi and idclientp = @idclient and Date_Start= @PayrollPeriodStart  order by grossalary desc --Get max idpayrollsumid 
				SELECT @countempidphi =  COUNT(Employee_id) FROM  payroll_summary where Employee_id = @idemployeephi and idclientp = @idclient and Date_Start= @PayrollPeriodStart
				
				SELECT @forphitotalgrossprevious= COALESCE(Sum(grossamttaxable),0) from payroll_summary WHERE Employee_id = @idemployeephi and Date_End= @previouscuttoffphi  --Previous Basic
				SELECT @forphitotalbasicprevious= COALESCE(Sum(basic),0) from payroll_summary WHERE Employee_id = @idemployeephi and Date_End= @previouscuttoffphi  --Previous Basic
				SELECT @forphitotalotherbasisprevious= COALESCE(Sum(othermandatorybasis),0) from payroll_summary WHERE Employee_id = @idemployeephi and Date_End= @previouscuttoffphi  --Previous Basic
				
												
				SELECT @forphitotalgross= COALESCE(Sum(grossamttaxable),0) from payroll_summary WHERE Employee_id = @idemployeephi and  idclientp = @idclient and Date_Start= @PayrollPeriodStart AND idpayrollsum < @idpayroll0  --gross
				
			SELECT 
    @forphitotalbasic = 
        CASE 
            WHEN @fixrate0 = 'Y' THEN  cast(@monthlysalary as float)
              
            WHEN @fixrate0 = 'N' THEN 
                COALESCE(SUM(basic), 0)
        END
		FROM payroll_summary
		WHERE Employee_id = @idemployeephi
		AND idclientp = @idclient
		AND Date_Start = @PayrollPeriodStart
		AND idpayrollsum < @idpayroll0;		  -- basic


				

				SELECT @forphitotalotherbasis= COALESCE(Sum(othermandatorybasis),0) from payroll_summary WHERE Employee_id = @idemployeephi and  idclientp = @idclient and Date_Start= @PayrollPeriodStart AND idpayrollsum < @idpayroll0  --other basis
												
				
				--SELECT @forphigrandtotalotherbasis =@basicamt+ @forphitotalbasic + @forphitotalbasicprevious -- grandtoal otherbasis
								
				SELECT @forphigrandtotalotherbasis1=(@otherbasisamt0+ @forphitotalotherbasis + @forphitotalotherbasisprevious)
				-- this condition set if otherbasis is greater than monthly salay then use monthly salary as reference to compare to philhealth table 
				SET @forphigrandtotalotherbasis2 = 
					CASE 
						WHEN @forphigrandtotalotherbasis1>=@monthlysalary THEN @monthlysalary
						else
						@forphigrandtotalotherbasis1
						
					END;
				
				SELECT @forphigrandtotalgross =cast(@grossamt0 as float)+ cast(@forphitotalgross as float) + cast(@forphitotalgrossprevious as float) -- grandtoal gross
				
				if @fixrate0 ='Y'
					BEGIN
						SELECT @forphigrandtotalbasic =cast(@forphitotalbasic as float)-- GET MONTHLY SALARY 
					END 
					if @fixrate0 ='N'
					BEGIN
						SELECT @forphigrandtotalbasic =cast(@basicamt0 as float)+ cast(@forphitotalbasic as float) + cast(@forphitotalbasicprevious as float) -- grandtoal basic
					END 


					
				SELECT @forphigrandtotalotherbasis =@forphigrandtotalotherbasis2				

				--SELECT @forphigrandtotalotherbasis = @otherbasisamt+ @forphitotalotherbasis + @forphitotalotherbasisprevious
								
				--PHILHEALTH PREVIOS CUTTOFF
				SELECT @previousphiee= COALESCE(Sum(contributionphilhealthEE),0) from payroll_summary WHERE Employee_id = @idemployeephi and Date_End= @previouscuttoffphi  --Previous EE	
				SELECT @previousphier= COALESCE(Sum(contributionphilhealthER),0) from payroll_summary WHERE Employee_id = @idemployeephi and Date_End= @previouscuttoffphi  --previous ER
	
									   				
				--PHILHEALTHEE othertrx		
				SELECT @philhealtheeotherentry = COALESCE(Sum(contributionphilhealthEE),0) from payroll_summary WHERE Employee_id = @idemployeesss and  Date_Start= @PayrollPeriodStart and idpayrollsum < @idpayroll0
				--PHILHEALTHER othertrx		
				SELECT @philhealtherotherentry = COALESCE(Sum(contributionphilhealthER),0) from payroll_summary WHERE Employee_id = @idemployeesss and Date_Start= @PayrollPeriodStart and idpayrollsum < @idpayroll0
				

									
				SELECT TOP 1  @phiIDgross = idphilhealth FROM Philhealth_2018 where Range <= @forphigrandtotalgross order by Range desc -- get id from philheal2018 gross current cuttoff reference
				SELECT TOP 1  @phiIDbasic = idphilhealth FROM Philhealth_2018 where Range <= @forphigrandtotalbasic order by Range desc --get id from philheal2018 basic reference bothprevioud and current
				SELECT TOP 1  @phiIDotherbasis= idphilhealth FROM Philhealth_2018 where Range <= @forphigrandtotalotherbasis order by Range desc --get id from philheal2018 basic reference
				
			
				SELECT  @phieevaluegross1 = Employeephil FROM Philhealth_2018 where idphilhealth = @phiIDgross --get the value of philhealt ee
				SELECT  @phiervaluegross1 = Employerphil FROM Philhealth_2018 where idphilhealth = @phiIDgross --get the value of philhealt er
				
				SELECT  @phieevaluebasic1 = Employeephil FROM Philhealth_2018 where idphilhealth = @phiIDbasic --get the value of philhealt ee
				SELECT  @phiervaluebasic1 = Employerphil FROM Philhealth_2018 where idphilhealth = @phiIDbasic --get the value of philhealt er
				
				SELECT  @phieevalueotherbasis1 = Employeephil FROM Philhealth_2018 where idphilhealth = @phiIDotherbasis --get the value of philhealt ee
				SELECT  @phiervalueotherbasis1 = Employerphil FROM Philhealth_2018 where idphilhealth = @phiIDotherbasis --get the value of philhealt er
											   
				SELECT  @phipercentgross = valPercentage FROM Philhealth_2018 where idphilhealth = @phiIDgross --get the value of percent				
				SELECT  @phipercentbasic = valPercentage FROM Philhealth_2018 where idphilhealth = @phiIDbasic --get the value of percent
				SELECT  @phipercentotherbasis = valPercentage FROM Philhealth_2018 where idphilhealth = @phiIDotherbasis --get the value of percent
								
														   

				----gross employee							   					 				  
				SET @phieegross =  										
						CASE 
							WHEN @forphigrandtotalgross >=1000.00 THEN 
							CASE 
								WHEN @phiIDgross = 1 THEN @phieevaluegross1-@previousphiee --- just get the amount from philhealthealth column
								WHEN @phiIDgross = 2 THEN ((@forphigrandtotalgross*@phipercentgross)/2)-@previousphiee
								WHEN @phiIDgross = 3 THEN @phieevaluegross1 - @previousphiee
							END
							ELSE
							0
						END;

				--- Basic Employer
				SET @phiergross= 
						CASE 
							WHEN @forphigrandtotalgross >=1000.00 THEN 
							CASE  
								WHEN @phiIDgross = 1 THEN @phiervaluegross1-@previousphier --- just get the amount from philhealthealth column
								WHEN @phiIDgross = 2 THEN ((@forphigrandtotalgross*@phipercentgross)/2)-@previousphier
								WHEN @phiIDgross = 3 THEN @phiervaluegross1 - @previousphier
							END
						ELSE
						0
						END;
				
				
				----basic employee							   					 				  
				SET @phieebasic =  										
						CASE 
							WHEN @forphigrandtotalgross >=1000.00 THEN 
							CASE 
								WHEN @phiIDbasic = 1 THEN @phieevaluebasic1-@previousphiee --- just get the amount from philhealthealth column
								WHEN @phiIDbasic = 2 THEN ((@forphigrandtotalbasic*@phipercentbasic)/2)-@previousphiee
								WHEN @phiIDbasic = 3 THEN @phieevaluebasic1 - @previousphiee
							END
							ELSE
							1234
							--0
						END;

				--- Basic Employer
				SET @phierbasic= 
						CASE 
							WHEN @forphigrandtotalgross >=1000.00 THEN 
							CASE  
								WHEN @phiIDbasic = 1 THEN @phiervaluebasic1-@previousphier --- just get the amount from philhealthealth column
								WHEN @phiIDbasic = 2 THEN ((@forphigrandtotalbasic*@phipercentbasic)/2)-@previousphier
								WHEN @phiIDbasic = 3 THEN @phiervaluebasic1 - @previousphier
							END
						ELSE
						0
						END;
			

				
				----other basis employee							   					 				  
				SET @phieeotherbasis =  										
						CASE 
							WHEN @forphigrandtotalgross >=1000.00 THEN 
							CASE 
								WHEN @phiIDotherbasis = 1 THEN @phieevalueotherbasis1-@previousphiee --- just get the amount from philhealthealth column
								WHEN @phiIDotherbasis = 2 THEN ((@forphigrandtotalotherbasis*@phipercentotherbasis)/2)-@previousphiee
								WHEN @phiIDotherbasis = 3 THEN @phieevalueotherbasis1 - @previousphiee
							END
							ELSE
							0
						END;

				--- Basic Employer
				SET @phierotherbasis= 
						CASE 
							WHEN @forphigrandtotalgross >=1000.00 THEN 
							CASE  
								WHEN @phiIDotherbasis = 1 THEN @phiervalueotherbasis1-@previousphier --- just get the amount from philhealthealth column
								WHEN @phiIDotherbasis = 2 THEN ((@forphigrandtotalotherbasis*@phipercentbasic)/2)-@previousphier
								WHEN @phiIDotherbasis = 3 THEN @phiervalueotherbasis1 - @previousphier
							END
						ELSE
						--0
						10000
						END;

											   


			if @phibasis = 'gross'	and @countempidphi =1 and @withphi='Y'	
	  			Begin
					set @phieebasic2 = @phieegross
					set @phierbasic2 = @phiergross
				End

		   if @phibasis = 'gross'	and @countempidphi =1 and @withphi='N'	
	  			Begin
					set @phieebasic2 = 0
					set @phierbasic2 = 0
				End


			if @phibasis = 'gross' and @countempidphi >1  and @withphi='Y'
				Begin
					set @phieebasic2 = @phieegross
					set @phierbasic2 = @phiergross
				End	
				
			if @phibasis = 'basic' and @countempidphi =1 and @withphi='Y'
				Begin
					set @phieebasic2 = @phieebasic
					set @phierbasic2 = @phierbasic
				End
			if @phibasis = 'basic' and @countempidphi >1 and @withphi='Y'
				Begin
					set @phieebasic2 = cast(@phieebasic as float)-cast(@philhealtheeotherentry as float)
					set @phierbasic2 = cast(@phieebasic as float)-cast(@philhealtherotherentry as float)
				End	


			if @phibasis = 'others' and @countempidphi =1 and @withphi='Y' and @idclient <>44
				Begin
					set @phieebasic2 = @phieeotherbasis
					set @phierbasic2 = @phierotherbasis
				End
			
			if @phibasis = 'others' and @countempidphi >1 and @withphi='Y' and @idclient <>44
				Begin
					set @phieebasic2 = @phieeotherbasis
					set @phierbasic2 = @phieeotherbasis
				End	


			if @phibasis = 'others' and @countempidphi =1 and @withphi='Y' and @idclient =44
				Begin
					set @phieebasic2 = @phieeotherbasis
					set @phierbasic2 = @phierotherbasis
				End
			if @phibasis = 'others' and @countempidphi >1 and @withphi='Y' and @idclient =44
				Begin
					set @phieebasic2 = cast(@phieeotherbasis as float) - cast(@philhealtheeotherentry as float)
					set @phierbasic2 = cast(@phieeotherbasis as float) - cast(@philhealtherotherentry as float)
				End	


	FETCH NEXT FROM myCursor3 INTO @idemployeephi,@phibasis
	END
	CLOSE myCursor3
	DEALLOCATE myCursor3

	update payroll_summary  set 
	contributionphilhealthEE = 	 @phieebasic2, contributionphilhealthER	= @phieebasic2, basicforphil = @forphitotalbasicprevious
	where idpayrollsum = @idpayroll0



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

DECLARE @pagibigeeotherentry  FLOAT 
DECLARE @pagibigerotherentry FLOAT

 --DECLARE @PayrollPeriodStart1 VARCHAR(20) = '2023-04-16'
declare @previouscuttoffpag as date
SET @previouscuttoffpag = DATEADD(DAY, -1, @PayrollPeriodStart)


    
DECLARE myCursor4 CURSOR FOR
-- open payroll summary      

SELECT employee_id,sssbasis FROM payroll_summary where idclientp = @idclient and Date_Start=@PayrollPeriodStart  AND employee_id = @idemployee0  order by idpayrollsum
 
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
				SELECT @forpagtotalgross = @grossamt0
				
				--SELECT @previouspagee= COALESCE(Sum(contributionPagibigEE),0) from payroll_summary WHERE Employee_id = @idemployeepag and  idclientp = @idclient and Date_End= @previouscuttoffpag  --Previous EE	
				--SELECT @previouspager= COALESCE(Sum(contributionPagibigER),0) from payroll_summary WHERE Employee_id = @idemployeepag and  idclientp = @idclient and Date_End= @previouscuttoffpag  --previous ER
				
				SELECT @previouspagee= COALESCE(Sum(contributionPagibigEE),0) from payroll_summary WHERE Employee_id = @idemployeepag  and Date_End= @previouscuttoffpag  --Previous EE	
				SELECT @previouspager= COALESCE(Sum(contributionPagibigER),0) from payroll_summary WHERE Employee_id = @idemployeepag  and Date_End= @previouscuttoffpag  --previous ER

				--pagibigEE othertrx		
				SELECT @pagibigeeotherentry = COALESCE(Sum(contributionPagibigEE),0) from payroll_summary WHERE Employee_id = @idemployeesss and  Date_Start= @PayrollPeriodStart and idpayrollsum < @idpayroll0
				--pagibigEr othertrx				
				SELECT @pagibigerotherentry = COALESCE(Sum(contributionPagibigER),0) from payroll_summary WHERE Employee_id = @idemployeesss and Date_Start= @PayrollPeriodStart and idpayrollsum < @idpayroll0
				
				SELECT TOP 1  @pagibigcontribution= pagibigcontributionee FROM pagibigtable where idpagibig = 1   order by dateupdate desc
			
				SELECT TOP 1  @pageegross = @pagibigcontribution
				SELECT TOP 1  @pagergross = @pagibigcontribution
								
				--SELECT @forpagtotalbasic= COALESCE(Sum(basic),0) from payroll_summary WHERE Employee_id = @idemployeepag and  idclientp = @idclient and Date_Start= @PayrollPeriodStart 
				SELECT @forpagtotalbasic = @basicamt0
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
				
				

				if @pagbasis = 'gross' and @countempidpag=1 and @withpag='Y'				
				Begin
					set @pageebasic2 = @pageebasic
					set @pagerbasic2 = @pageebasic
				End
				
			else  if @pagbasis = 'gross'and @countempidpag	>1 	and @withpag='Y'
				Begin
					set @pageebasic2 = @pageebasic
					set @pagerbasic2 = @pageebasic

				End

				if @pagbasis = 'basic' and @countempidpag	=1 	and @withpag='Y'				
				Begin
					set @pageebasic2 = @pageebasic
					set @pagerbasic2 = @pageebasic
				End
				
			else  if @pagbasis = 'basic'and @countempidpag	>1 	and @withpag='Y'
				Begin
					set @pageebasic2 = @pageebasic
					set @pagerbasic2 = @pageebasic

				End


						
			 if @pagbasis = 'others' and @countempidpag	=1 and @withpag='Y' AND @idclient <> 44	
			 Begin
					set @pageebasic2 = @pageebasic
					set @pagerbasic2 = @pageebasic
				End
				
			else  if @pagbasis = 'others'and @countempidpag	>1 and @withpag='Y' AND @idclient <> 44	
				Begin
					set @pageebasic2 = cast(@pageebasic as float) - cast(@pagibigeeotherentry as float)
					set @pagerbasic2 = cast(@pagerbasic as float) - cast(@pagibigerotherentry as float)

				End

			 if @pagbasis = 'others' and @countempidpag	=1 and @withpag='Y' AND @idclient = 44	
			 Begin
					set @pageebasic2 = @pageebasic 
					set @pagerbasic2 = @pageebasic 
				End
				
			else  if @pagbasis = 'others'and @countempidpag	>1 and @withpag='Y' AND @idclient = 44	
				Begin
					set @pageebasic2 = cast(@pageebasic as float) - cast(@pagibigeeotherentry as float)
					set @pagerbasic2 = cast(@pagerbasic as float) - cast(@pagibigerotherentry as float)

				End
					
	FETCH NEXT FROM myCursor4 INTO @idemployeepag,@phibasis
	END
	CLOSE myCursor4
	DEALLOCATE myCursor4


	update payroll_summary  set 
	contributionPagibigEE = @pageebasic2,contributionPagibigER= @pageebasic2
	where idpayrollsum = @idpayroll0

	----------------------------------------------------END PAG IBIG

	 	 		 

	   
--------------------------------------------------------------------------Wtax-------------------------------------------
--DECLARE @idclient int =17
--DECLARE @PayrollPeriodStart varchar(20) = '2023-05-01'
--declare @idDepartment int = 17

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

SELECT employee_id FROM payroll_summary where idclientp = @idclient and Date_Start=@PayrollPeriodStart  AND employee_id = @idemployee0  order by idpayrollsum
 
	OPEN myCursor7
   
   FETCH NEXT FROM myCursor7 INTO @idemployeewtax
	WHILE @@FETCH_STATUS = 0
	
	BEGIN

		SELECT @PREVIOUSWTAX= COALESCE(Sum(WTAX),0) from payroll_summary WHERE Employee_id = @idemployeewtax  and Date_End= @previouscuttoffwtax  --Previous wtax   				 			  			  
	
		
		set @TOTALMANDATORIESPREVIOUS  = COALESCE(@ssseeprevious,0)+COALESCE(@previousphiee,0)+COALESCE(@previouspagee,0)+COALESCE(@prossseeprevious,0)
		--SET @TOTALMANDATORIES	=COALESCE(@ssseegrossfinal2,0)+COALESCE(@phieebasic2,0)+COALESCE(@pageebasic,0)+COALESCE(@prossseegrossfinal3,0)
		SET @TOTALMANDATORIES	=COALESCE(@ssseefinal3,0)+COALESCE(@phieebasic2,0)+COALESCE(@pageebasic2,0)+COALESCE(@prossseegrossfinal3,0)

		
		/*	green setup
		set @TOTALMANDATORIESPREVIOUS  = COALESCE(@ssseegrossprevious,0)+COALESCE(@previousphiee,0)+COALESCE(@previouspagee,0)+COALESCE(@prossseegrossprevious,0)
		SET @TOTALMANDATORIES	= COALESCE(@ssseegrossfinal2,0)+COALESCE(@phieebasic2,0)+COALESCE(@pageebasic,0)+COALESCE(@prossseegrossfinal3,0)
		  */



		SET @TOTALGROSS = @forssstotalgrossprevious+@grossamt0
		
		SET @TAXABLEINCOME = (cAST(@TOTALGROSS AS FLOAT))-(CAST(@TOTALMANDATORIES AS FLOAT)+cAST(@TOTALMANDATORIESPREVIOUS AS FLOAT))
		--SET @TAXABLEINCOME = CAST(@TOTALMANDATORIES AS FLOAT)+cAST(@TOTALMANDATORIESPREVIOUS AS FLOAT)
 
	
	
	
		SELECT TOP 1  @TAXCOMPENSATIONLEVEL =  compensationlevel FROM TAXTABLENEW where Term = 'Monthly' and Range1 <= @TAXABLEINCOME order by Series desc
		SELECT TOP 1  @TAXPERCENT =  Percentage  FROM TAXTABLENEW where Term = 'Monthly' and Range1 <= @TAXABLEINCOME order by Series desc
		SELECT TOP 1  @TAXPRESCRIBE =  PrescribeTax  FROM TAXTABLENEW where Term = 'Monthly' and Range1 <= @TAXABLEINCOME order by Series desc


		SET @TAXOVER  = @TAXABLEINCOME - @TAXCOMPENSATIONLEVEL
	
		SET @WTAXCOMPENSATION = @TAXOVER * @TAXPERCENT
	
		SET @WTAXCOMPENSATIONFINAL  = @TAXPRESCRIBE
		SET @WTAXCOMPENSATIONFINAL  =(@WTAXCOMPENSATION +@TAXPRESCRIBE)-@PREVIOUSWTAX
		---SET @WTAXCOMPENSATIONFINAL  =@TAXABLEINCOME
	


		FETCH NEXT FROM myCursor7 INTO @idemployeewtax
	END
	CLOSE myCursor7
	DEALLOCATE myCursor7


IF @idclient IN (171,173,74)
begin
	UPDATE payroll_summary
		SET Wtax = @WTAXCOMPENSATIONFINAL
	WHERE idpayrollsum = @idpayroll0
end



IF @idclient IN (81)
BEGIN
    UPDATE payroll_summary
    SET Wtax = CASE 
                    WHEN idbranchpositionp IN (5723,5726,5659,5736,5622) 
                    THEN @WTAXCOMPENSATIONFINAL 
                    ELSE 0 
               END
    WHERE idpayrollsum = @idpayroll0

	UPDATE payroll_summary
	  SET Wtax = @WTAXCOMPENSATIONFINAL
	WHERE idpayrollsum = @idpayroll0

END






-----------------------------End of Tax--------------------------------------------------


		   			 		  






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
     
	SELECT employee_id,idotherdeduction FROM otherdeduction where idclientdeduction = @idclient and Date_Start= @PayrollPeriodStart  AND employee_id = @idemployee0 order by idotherdeduction
	  
	OPEN myCursor1
   
	FETCH NEXT FROM myCursor1 INTO @Didemployee,@Diddeduction
	WHILE @@FETCH_STATUS = 0
	BEGIN
	  --- get the max idpayroll
	  SELECT TOP 1  @Didpayrollsum =  idpayrollsum FROM payroll_summary where Employee_id = @Didemployee and idclientp = @idclient and Date_Start= @PayrollPeriodStart   order by grossalary desc
	  	   
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

DECLARE @Totherdeduction float
DECLARE @Totherdeduction2 float
DECLARE @TTotaldeduction float

DECLARE @Tsss float
DECLARE @Tssspro float
DECLARE @Tphi float
DECLARE @Tpag float
DECLARE @Twtax float

DECLARE @TGrosssalary float
DECLARE @Ttotaldeduction1 float
DECLARE @TNetamount float
DECLARE @TNetamount2 float


DECLARE myCursor5 CURSOR FOR
     
	SELECT idpayrollsum,Employee_id FROM payroll_summary where idclientp = @idclient and Date_Start= @PayrollPeriodStart  AND employee_id = @idemployee0 AND idpayrollsum = @idpayroll0 order by idpayrollsum
	  
	OPEN myCursor5
   
	FETCH NEXT FROM myCursor5 INTO @Tidpayrollsum,@Temployee_id
	WHILE @@FETCH_STATUS = 0
	BEGIN
	   		SELECT @countempidfinal =  COUNT(Employee_id) FROM  payroll_summary where Employee_id = @TEmployee_id and idclientp = @idclient and Date_Start= @PayrollPeriodStart
			  			
			SELECT @Tsss= COALESCE(contributionSSSEE,0) from payroll_summary WHERE idpayrollsum = @Tidpayrollsum
			SELECT @Tssspro= COALESCE(contributionSSSEEpro,0) from payroll_summary WHERE idpayrollsum = @Tidpayrollsum
			SELECT @Tphi= COALESCE(contributionphilhealthEE,0) from payroll_summary WHERE idpayrollsum = @Tidpayrollsum
			SELECT @Tpag= COALESCE(contributionpagibigEE,0) from payroll_summary WHERE idpayrollsum = @Tidpayrollsum
			SELECT @Twtax= COALESCE(wtax,0) from payroll_summary WHERE idpayrollsum = @Tidpayrollsum
						
			SELECT @Totherdeduction= COALESCE(other_deduction,0) from payroll_summary WHERE idpayrollsum = @Tidpayrollsum 
			SELECT @Totherdeduction2= COALESCE(other_deduction2,0) from payroll_summary WHERE idpayrollsum = @Tidpayrollsum 

			SELECT @TTotaldeduction = CAST(@Tsss as float)+CAST(@Tssspro as float)+CAST(@Tphi as float)+CAST(@Tpag as float)+CAST(@Twtax as float)+CAST(@Totherdeduction as float)	

		--	IF @countempidfinal = 1 --only one trx 
			UPDATE payroll_summary SET Totaldeduction= @TTotaldeduction   WHERE idpayrollsum=@Tidpayrollsum 
				

			SELECT @TGrosssalary = COALESCE(grossalary,0) from payroll_summary WHERE idpayrollsum = @Tidpayrollsum
			
			SELECT @TNetamount = ROUND(CAST(@TGrosssalary AS DECIMAL(18,2)) - CAST(@TTotaldeduction AS DECIMAL(18,2)), 2)	
			SELECT @TNetamount2 = CAST(@TGrosssalary as float)-CAST(@TTotaldeduction as float)+@Totherdeduction2
			
		--	IF @countempidfinal = 1 --only one payroll
			UPDATE payroll_summary SET netamount= @TNetamount  ,netamount2= @TNetamount2   WHERE idpayrollsum= @Tidpayrollsum 
			
			--SET @Tsqltotalnet = ('UPDATE payroll_summary SET netamount=' + @TNetamount + ' ,netamount2=' + @TNetamount2 + '  WHERE idpayrollsum='+ @Tidpayrollsum + '')
			--execute(@Tsqltotalnet)
					   	   
		   FETCH NEXT FROM myCursor5 INTO @Tidpayrollsum,@Temployee_id
    END
	CLOSE myCursor5
	DEALLOCATE myCursor5
	  	  -------------------------------------- End Total Net amount single------------------------------------------------------






		     
---------------------------------NETAMOUNT <2000-------------------------------------
DECLARE @idemployee2K int  
DECLARE @TGrosssalary6 FLOAT
DECLARE @Tnetamount6 FLOAT

DECLARE @netamount2K int 
DECLARE @sumnetamount2K float
DECLARE @idpayrollsum6	int


DECLARE @TTotaldeduction6 varchar(20)
DECLARE @Ttotaldeduction26 varchar(30)

DECLARE @Totherdeduction6 float
DECLARE @Totherdeduction26 float

DECLARE @Tsss6 float
DECLARE @Tphi6 float
DECLARE @Tpag6 float
DECLARE @Twtax6 float


DECLARE myCursor6 CURSOR FOR

-- open payroll summary      
SELECT employee_id,@netamount2K FROM payroll_summary where idclientp = @idclient and Date_Start=@PayrollPeriodStart and  employee_id = @idemployee0 and netamount <=2000 order by idpayrollsum

 
	OPEN myCursor6
   
   FETCH NEXT FROM myCursor6 INTO @idemployeE2K,@netamount2k
	WHILE @@FETCH_STATUS = 0
	
	BEGIN
				--- get the max idpayroll
				SELECT TOP 1  @idpayrollsum6=  idpayrollsum FROM payroll_summary where Employee_id = @idemployeesss and idclientp = @idclient and Date_Start= @PayrollPeriodStart  order by grossalary desc
			
				--count trx
				--SELECT @countempidsss =  COUNT(Employee_id) FROM  payroll_summary where Employee_id = @idemployeesss and idclientp = @idclient and Date_Start= @PayrollPeriodStart
				
			
	update payroll_summary
	set contributionSSSEE =0, contributionSSSER = 0, contributionSSSECC = 0,
	contributionphilhealthEE = 0, contributionphilhealthER = 0,
	contributionPagibigEE = 0,contributionPagibigER = 0, 
	withsss = 'N', withphi ='N', withpag ='N', withssspro = 'N'		 
	where idpayrollsum = @idpayrollsum6


	SELECT @Tsss6= COALESCE(contributionSSSEE,0) from payroll_summary WHERE idpayrollsum = @idpayrollsum6
	SELECT @Tphi6= COALESCE(contributionphilhealthEE,0) from payroll_summary WHERE idpayrollsum = @idpayrollsum6
	SELECT @Tpag6= COALESCE(contributionpagibigEE,0) from payroll_summary WHERE idpayrollsum = @idpayrollsum6
	SELECT @Twtax6= COALESCE(wtax,0) from payroll_summary WHERE idpayrollsum = @idpayrollsum6
						
	SELECT @Totherdeduction6= COALESCE(other_deduction,0) from payroll_summary WHERE idpayrollsum = @idpayrollsum6 
	--SELECT @Totherdeduction26= COALESCE(other_deduction2,0) from payroll_summary WHERE idpayrollsum = @idpayrollsum6 

	SELECT @TGrosssalary6 = COALESCE(grossalary,0) from payroll_summary WHERE idpayrollsum = @idpayrollsum6

	SELECT @TTotaldeduction6 = CAST(@Tsss6 as float)+CAST(@Tphi6 as float)+CAST(@Tpag6 as float)+CAST(@Twtax6 as float)+CAST(@Totherdeduction6 as float)

			
	UPDATE payroll_summary SET Totaldeduction= @TTotaldeduction6   WHERE idpayrollsum=@idpayrollsum6 

	SELECT @TNetamount6 = CAST(@TGrosssalary6 as float)-CAST(@TTotaldeduction6 as float)					
	UPDATE payroll_summary SET netamount= @TNetamount6  ,netamount2= @TNetamount6   WHERE idpayrollsum= @Tidpayrollsum 


   FETCH NEXT FROM myCursor6 INTO @idemployeE2K,@netamount2k
	END
	CLOSE myCursor6
	DEALLOCATE myCursor6




-----------------------------------------END <2000-----------------------------------



 
		      FETCH NEXT FROM myCursor0 INTO @idpayroll0,@idemployee0,@sssbasis0,@grossamt0,@basicamt0,@otherbasisamt0,@withsss,@withssspro,@withphi,@withpag,@monthlysalary,@otherbasisamt0,@fixrate0
	END
	CLOSE myCursor0
	DEALLOCATE myCursor0

END
















/*

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
                               HAVING         (COUNT(*) > 1) AND (Date_Start = @PayrollPeriodStart) AND (idclientp = @idclient) AND (Employee_id = @idemployee0))) AND (idclientp = @idclient) AND (Date_Start = @PayrollPeriodStart)
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






 /*
 --select [sssemployee] = @ssseefinal3,[sssemployer]=@ssserfinal3,[sssecc]= @sssECCfinal3,[prosssemployee]= @prossseegrossfinal3,[prosssemployer]=@prosssergrossfinal3,[Philhealthee]= @phieebasic2,[pagibigee] = @pageebasic2,[sssprevious] =@forssstotalotherbasisprevious,[phiprevious] = @forssstotalotherbasisprevious, [wtaxcompensationfinal] = @WTAXCOMPENSATIONFINAL

--select [sssemployee] = @finalssseegross2,[sssemployer]=@finalsssergross2,[sssecc]= @finalssseccgross2,[Philhealthee] = @phieebasic2,[pagibigee] = @pageebasic

--select [sssemployee] = @ssseefinal3,[sssemployer]=@ssserfinal3,[sssecc]= @sssECCfinal3,[prosssemployee]= @prossseegrossfinal3,[prosssemployer]=@prosssergrossfinal3,[Philhealthee]= @phieebasic2,[pagibigee] = @pageebasic2,[sssprevious] =@forssstotalotherbasisprevious,[phiprevious] = @forssstotalotherbasisprevious, [wtaxcompensationfinal] = @WTAXCOMPENSATIONFINAL

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
*/
