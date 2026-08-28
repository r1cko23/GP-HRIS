
CREATE PROCEDURE [dbo].[42bf00bd-6230-462f-a118-a3d93166c3b9V230INDWEEKLYTAX]

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
@payrollmonth nvarchar(20),
@sssamt float,
@sssproamt float,
@phiamt float,
@pagamt float

AS
BEGIN

	   
--------------------------------------------------------------------------Wtax-------------------------------------------
--DECLARE @idclient int =17
--DECLARE @PayrollPeriodStart varchar(20) = '2023-05-01'
--declare @idDepartment int = 17

DECLARE @wtaxbasis nvarchar(7)
SELECT TOP 1  @wtaxbasis =  wtaxbasis FROM payroll_summary where Employee_id = @idemployee and idclientp = @idclient and Date_Start= @PayrollPeriodStart 


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

DECLARE @forssstotalgrossprevious FLOAT
declare @ssseeprevious float
declare @prossseeprevious float
declare @previousphiee float
declare @previouspagee float


DECLARE @ssseefinal3 FLOAT
DECLARE @prossseegrossfinal3 FLOAT
DECLARE @phieebasic2 FLOAT
DECLARE @pageebasic2 FLOAT


declare @previouscuttoffwtax as date
SET @previouscuttoffwtax = DATEADD(DAY, -1, @PayrollPeriodStart)

DECLARE myCursor7 CURSOR FOR
-- open payroll summary it also use this to select record where the data should fall

SELECT employee_id FROM payroll_summary where idclientp = @idclient and Date_Start=@PayrollPeriodStart and department_codep = @idDepartment AND employee_id = @idemployee  order by idpayrollsum
 
	OPEN myCursor7
   
   FETCH NEXT FROM myCursor7 INTO @idemployeewtax
	WHILE @@FETCH_STATUS = 0
	
	BEGIN
			 
		SELECT @forssstotalgrossprevious= COALESCE(Sum(grossamttaxable),0) from payroll_summary WHERE Employee_id = @idemployeewtax and idclientp = @idclient  and  payrollmonth= @payrollmonth  and idpayrollsum <@idpayroll
	
		SELECT @PREVIOUSWTAX= COALESCE(Sum(WTAX),0) from payroll_summary WHERE Employee_id = @idemployeewtax and idclientp = @idclient   and payrollmonth= @payrollmonth  and idpayrollsum <@idpayroll  --Previous wtax   
		


	
		
		SELECT @ssseeprevious = COALESCE(Sum(contributionSSSEE),0) from payroll_summary WHERE Employee_id = @idemployeewtax and idclientp = @idclient  and  payrollmonth  =@payrollmonth and idpayrollsum <@idpayroll
		SELECT @prossseeprevious = COALESCE(Sum(contributionSSSEEpro),0) from payroll_summary WHERE Employee_id = @idemployeewtax and idclientp = @idclient  and  payrollmonth =@payrollmonth and idpayrollsum <@idpayroll
		SELECT @previousphiee= COALESCE(Sum(contributionphilhealthEE),0) from payroll_summary WHERE Employee_id = @idemployeewtax and idclientp = @idclient  and  payrollmonth =@payrollmonth and idpayrollsum <@idpayroll
		SELECT @previouspagee= COALESCE(Sum(contributionPagibigEE),0) from payroll_summary WHERE Employee_id = @idemployeewtax and idclientp = @idclient   and  payrollmonth  =@payrollmonth and idpayrollsum <@idpayroll --Previous EE	
	
		--SELECT @ssseefinal3= COALESCE(Sum(contributionSSSEE),0) from payroll_summary 
		--WHERE Employee_id = @idemployeewtax and  idclientp = @idclient and  payrollmonth=@payrollmonth and idpayrollsum = @idpayroll

		--SELECT @prossseegrossfinal3= COALESCE(Sum(contributionSSSEEPRO),0) from payroll_summary 
		--WHERE Employee_id = @idemployeewtax and  idclientp = @idclient and payrollmonth  = @payrollmonth and idpayrollsum = @idpayroll
			
		--SELECT @phieebasic2= COALESCE(Sum(contributionphilhealthEE),0) from payroll_summary 
		--WHERE Employee_id = @idemployeewtax and  idclientp = @idclient and payrollmonth  <@payrollmonth and idpayrollsum = @idpayroll

		--SELECT @pageebasic2= COALESCE(Sum(contributionPagibigEE),0) from payroll_summary 
		--WHERE Employee_id = @idemployeewtax and  idclientp = @idclient and  payrollmonth  <@payrollmonth and idpayrollsum = @idpayroll




		set @TOTALMANDATORIESPREVIOUS  = COALESCE(@ssseeprevious,0)+COALESCE(@prossseeprevious,0)+COALESCE(@previousphiee,0)+COALESCE(@previouspagee,0)
		SET @TOTALMANDATORIES	= COALESCE(@sssamt,0)+COALESCE(@phiamt,0)+COALESCE(@pagamt,0)+COALESCE(@sssproamt,0)



		--if @wtaxbasis ='gross' 
		SET @TOTALGROSS = @forssstotalgrossprevious+@grossamt
		
		--if @wtaxbasis  ='basic'
		--SET @TOTALGROSS = @forssstotalbasicprevious+@basicamt
		


		SET @TAXABLEINCOME = (CAST(@TOTALGROSS AS FLOAT))-(cAST(@TOTALMANDATORIES AS FLOAT)+cAST(@TOTALMANDATORIESPREVIOUS AS FLOAT))
 
	
	
	
		SELECT TOP 1  @TAXCOMPENSATIONLEVEL =  compensationlevel FROM TAXTABLENEW where Term = 'Monthly' and Range1 <= @TAXABLEINCOME order by Series desc
		SELECT TOP 1  @TAXPERCENT =  Percentage  FROM TAXTABLENEW where Term = 'Monthly' and Range1 <= @TAXABLEINCOME order by Series desc
		SELECT TOP 1  @TAXPRESCRIBE =  PrescribeTax  FROM TAXTABLENEW where Term = 'Monthly' and Range1 <= @TAXABLEINCOME order by Series desc


		SET @TAXOVER  = @TAXABLEINCOME - @TAXCOMPENSATIONLEVEL
	
		SET @WTAXCOMPENSATION = @TAXOVER * @TAXPERCENT
	
		--SET @WTAXCOMPENSATIONFINAL  = @TAXPRESCRIBE --DISABLE
		SET @WTAXCOMPENSATIONFINAL  =(@WTAXCOMPENSATION +@TAXPRESCRIBE)-@PREVIOUSWTAX
		
		--SET @WTAXCOMPENSATIONFINAL  =@TOTALMANDATORIES
	


		FETCH NEXT FROM myCursor7 INTO @idemployeewtax
	END
	CLOSE myCursor7
	DEALLOCATE myCursor7


-----------------------------End of Tax--------------------------------------------------

--select [sssemployee] = @finalssseegross2,[sssemployer]=@finalsssergross2,[sssecc]= @finalssseccgross2,[Philhealthee] = @phieebasic2,[pagibigee] = @pageebasic

select  [wtaxcompensationfinal] = @WTAXCOMPENSATIONFINAL
--select  [wtaxcompensationfinal] = @TOTALMANDATORIES
--select  [wtaxcompensationfinal] = @TOTALMANDATORIESPREVIOUS





END
