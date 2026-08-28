
CREATE PROCEDURE [dbo].[42bf00bd-6230-462f-a118-a3d93166c3b9V230INDmassPHI]

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
				SELECT @philhealtheeotherentry = COALESCE(Sum(contributionphilhealthEE),0) from payroll_summary WHERE Employee_id = @idemployeephi and  Date_Start= @PayrollPeriodStart and idpayrollsum < @idpayroll0
				--PHILHEALTHER othertrx		
				SELECT @philhealtherotherentry = COALESCE(Sum(contributionphilhealthER),0) from payroll_summary WHERE Employee_id = @idemployeephi and Date_Start= @PayrollPeriodStart and idpayrollsum < @idpayroll0
				

									
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
	contributionphilhealthEE = ROUND(@phieebasic2,2)
	,contributionphilhealthER= ROUND(@phieebasic2,2)
	,basicforphil =  ROUND(@forphitotalbasicprevious,2)
	where idpayrollsum = @idpayroll0



	---------------------------------------------- END Philhealth process --------------------------------------------------------------------



		 

 
		      FETCH NEXT FROM myCursor0 INTO @idpayroll0,@idemployee0,@sssbasis0,@grossamt0,@basicamt0,@otherbasisamt0,@withsss,@withssspro,@withphi,@withpag,@monthlysalary,@otherbasisamt0,@fixrate0
	END
	CLOSE myCursor0
	DEALLOCATE myCursor0

END






