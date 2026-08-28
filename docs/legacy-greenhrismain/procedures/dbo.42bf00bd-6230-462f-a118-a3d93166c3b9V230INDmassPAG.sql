
CREATE PROCEDURE [dbo].[42bf00bd-6230-462f-a118-a3d93166c3b9V230INDmassPAG]

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
				SELECT @pagibigeeotherentry = COALESCE(Sum(contributionPagibigEE),0) from payroll_summary WHERE Employee_id = @idemployeepag and  Date_Start= @PayrollPeriodStart and idpayrollsum < @idpayroll0
				--pagibigEr othertrx				
				SELECT @pagibigerotherentry = COALESCE(Sum(contributionPagibigER),0) from payroll_summary WHERE Employee_id = @idemployeepag and Date_Start= @PayrollPeriodStart and idpayrollsum < @idpayroll0
				
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
					
	FETCH NEXT FROM myCursor4 INTO @idemployeepag,@pagbasis
	END
	CLOSE myCursor4
	DEALLOCATE myCursor4


	update payroll_summary  set 
	contributionPagibigEE = @pageebasic2,contributionPagibigER= @pageebasic2
	where idpayrollsum = @idpayroll0

	----------------------------------------------------END PAG IBIG

	 	 	 


 
		      FETCH NEXT FROM myCursor0 INTO @idpayroll0,@idemployee0,@sssbasis0,@grossamt0,@basicamt0,@otherbasisamt0,@withsss,@withssspro,@withphi,@withpag,@monthlysalary,@otherbasisamt0,@fixrate0
	END
	CLOSE myCursor0
	DEALLOCATE myCursor0

END







