
CREATE PROCEDURE [dbo].[42bf00bd-6230-462f-a118-a3d93166c3b9V230INDWEEKLYPHILHEALTH]

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
---------------------------------------------- Start Philhealth process --------------------------------------------------------------------

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

declare @previouscuttoffphi as date
SET @previouscuttoffphi = DATEADD(DAY, -1, @PayrollPeriodStart)
 
     
DECLARE myCursor3 CURSOR FOR
-- open payroll summary      

SELECT employee_id,philhealthbasis FROM payroll_summary where idclientp = @idclient and Date_Start=@PayrollPeriodStart and department_codep = @idDepartment AND employee_id = @idemployee order by idpayrollsum
 
	OPEN myCursor3
   
   FETCH NEXT FROM myCursor3 INTO @idemployeephi,@phibasis
	WHILE @@FETCH_STATUS = 0
	
	BEGIN
			
				SELECT TOP 1  @phiidpayrollsum2 =  idpayrollsum FROM payroll_summary where Employee_id = @idemployeephi and idclientp = @idclient and Date_Start= @PayrollPeriodStart  order by idpayrollsum desc --Get max idpayrollsumid 
				SELECT @countempidphi =  COUNT(Employee_id) FROM  payroll_summary where Employee_id = @idemployeephi and idclientp = @idclient  and payrollmonth= @payrollmonth
				
				SELECT @forphitotalgross= COALESCE(Sum(grossamttaxable),0) from payroll_summary WHERE Employee_id = @idemployeephi and  idclientp = @idclient and Date_Start= @PayrollPeriodStart  
				SELECT @forphitotalgross1 = @grossamt+@forphitotalgross

				--PREVIOUS 
				SELECT @forphitotalbasicprevious= COALESCE(Sum(basic),0) from payroll_summary WHERE Employee_id = @idemployeephi and idclientp = @idclient  and  payrollmonth= @payrollmonth and idpayrollsum<@idpayroll  --Previous Basic

				--CURRENT
				SELECT @forphitotalbasic= COALESCE(Sum(basic),0) from payroll_summary WHERE Employee_id = @idemployeephi and  idclientp = @idclient  and payrollmonth= @payrollmonth  and  idpayrollsum = @idpayroll   --basic Basis
				
				
				

				SELECT @forphigrandtotalbasic = @basicamt+ @forphitotalbasicprevious -- grandtoal basic

				SELECT @TDAYSPHI= COALESCE(Sum(noofdayswork),0) from payroll_summary WHERE Employee_id = @idemployeephi and  idclientp = @idclient and Date_Start= @PayrollPeriodStart  --TOTALNO OF DAYS
			
					
				SELECT @previousphiee= COALESCE(Sum(contributionphilhealthEE),0) from payroll_summary WHERE Employee_id = @idemployeephi and idclientp = @idclient  and  payrollmonth= @payrollmonth and idpayrollsum <@idpayroll  --Previous EE	
				SELECT @previousphier= COALESCE(Sum(contributionphilhealthER),0) from payroll_summary WHERE Employee_id = @idemployeephi and idclientp = @idclient  and  payrollmonth= @payrollmonth and idpayrollsum <@idpayroll --previous ER
	
									
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

				
			if @phibasis = 'Gross'and @countempidphi =1  and @withphi=1	  --NOT YET ALIGN					
	  			Begin
					print 'test'
					-- update payroll_summary set contributionphilhealthEE = @phiee,contributionphilhealthER=@phier where idpayrollsum=@phiidpayrollsum2
					
				End
			if @phibasis = 'Basic' and @countempidphi =1 and @withphi=1
				Begin
					--update payroll_summary set contributionphilhealthEE = @phieebasic,contributionphilhealthER=@phieebasic where idpayrollsum=@phiidpayrollsum2
					set @phieebasic2 = @phieebasic
					set @phierbasic2 = @phieebasic
				End

			 if @phibasis = 'Basic' and @countempidphi >1 and @withphi=1
				Begin
					set @phieebasic2 = @phieebasic
					set @phierbasic2 = @phieebasic
				End	


	FETCH NEXT FROM myCursor3 INTO @idemployeephi,@phibasis
	END
	CLOSE myCursor3
	DEALLOCATE myCursor3


---------------------------------------------- END Philhealth process --------------------------------------------------------------------


select [Philhealthee]= @phieebasic2

END
