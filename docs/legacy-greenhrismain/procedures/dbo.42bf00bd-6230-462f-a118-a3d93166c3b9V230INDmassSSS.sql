
CREATE PROCEDURE [dbo].[42bf00bd-6230-462f-a118-a3d93166c3b9V230INDmassSSS]

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



DECLARE @ssspreviousamountfinal float
DECLARE @philpreviousamountfinal float


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

				SET @ssspreviousamountfinal =  @forssstotalgrossprevious
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

				SET @ssspreviousamountfinal =  @forssstotalbasicprevious

			
			End 
		
			


							   									   					 				  				  				 
			if @sssbasis = 'basic' and @countempidsss =1  and @withsss='Y'  
			Begin
				SET @ssseefinal3 = cast(@ssseebasicfinal2 as float)	-cast(@ssseeotherentry as float)
				SET @ssserfinal3 = cast(@ssserbasicfinal2 as float)	- cast(@ssserotherentry as float)
				SET @sssECCfinal3 = cast(@sssECCbasicfinal2 as float) -cast(@sssECCotherentry as float)		
				SET @ssspreviousamountfinal =  @forssstotalbasicprevious
			
			End 

			 				   									   					 				  				  				 
			if @sssbasis = 'basic' and @countempidsss =1  and @withsss='N'  
			Begin
				SET @ssseefinal3 = 0
				SET @ssserfinal3 =0
				SET @sssECCfinal3 =0								
			
			End 

			
			if @sssbasis = 'basic' and @countempidsss >1  and @withsss='Y'  --if more than 2 records basic reference
		  	BEgin		
				SET @ssseefinal3 = cast(@ssseebasicfinal2 as float)-cast(@ssseeotherentry as float)
				SET @ssserfinal3 = cast(@ssserbasicfinal2 as float)-cast(@ssserotherentry as float)
				SET @sssECCfinal3 =cast(@sssECCbasicfinal2 as float)-cast(@sssECCotherentry as float)  
				SET @ssspreviousamountfinal =  @forssstotalbasicprevious
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
	set contributionSSSEE =   @ssseefinal3,contributionSSSER =@ssserfinal3,contributionSSSECC=@sssECCfinal3	, basicforsss=@ssspreviousamountfinal
	where idpayrollsum = @idpayroll0		
	

	---------------------------------------------------End SSS PRocess -------------------------------------------------------------------------







 
		      FETCH NEXT FROM myCursor0 INTO @idpayroll0,@idemployee0,@sssbasis0,@grossamt0,@basicamt0,@otherbasisamt0,@withsss,@withssspro,@withphi,@withpag,@monthlysalary,@otherbasisamt0,@fixrate0
	END
	CLOSE myCursor0
	DEALLOCATE myCursor0

END












