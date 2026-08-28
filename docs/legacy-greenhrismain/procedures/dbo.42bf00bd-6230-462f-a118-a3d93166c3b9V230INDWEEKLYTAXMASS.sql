
CREATE PROCEDURE [dbo].[42bf00bd-6230-462f-a118-a3d93166c3b9V230INDWEEKLYTAXMASS]

@idemployee INT,
@idclient int,
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
@frequencypayment nvarchar(20),
@wtaxsched nvarchar(20)


AS
BEGIN
   
--------------------------------------------------------------------------Wtax-------------------------------------------


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

SELECT employee_id FROM payroll_summary where idclientp = @idclient and Date_Start=@PayrollPeriodStart AND employee_id = @idemployee  order by idpayrollsum desc
 
	OPEN myCursor7
   
   FETCH NEXT FROM myCursor7 INTO @idemployeewtax
	WHILE @@FETCH_STATUS = 0
	
	BEGIN
			 
		SELECT @forssstotalgrossprevious= COALESCE(Sum(grossamttaxable),0) from payroll_summary WHERE Employee_id = @idemployeewtax and  payrollmonth= @payrollmonth  and idpayrollsum <@idpayroll
	
		SELECT @PREVIOUSWTAX= COALESCE(Sum(WTAX),0) from payroll_summary WHERE Employee_id = @idemployeewtax  and payrollmonth= @payrollmonth  and idpayrollsum <@idpayroll  --Previous wtax   
		

		
		SELECT @ssseeprevious = COALESCE(Sum(contributionSSSEE),0) from payroll_summary WHERE Employee_id = @idemployeewtax and idclientp = @idclient and payrollmonth  =@payrollmonth and idpayrollsum <@idpayroll
		SELECT @prossseeprevious = COALESCE(Sum(contributionSSSEEpro),0) from payroll_summary WHERE Employee_id = @idemployeewtax and idclientp = @idclient and  payrollmonth =@payrollmonth and idpayrollsum <@idpayroll
		SELECT @previousphiee= COALESCE(Sum(contributionphilhealthEE),0) from payroll_summary WHERE Employee_id = @idemployeewtax and idclientp = @idclient and  payrollmonth =@payrollmonth and idpayrollsum <@idpayroll
		SELECT @previouspagee= COALESCE(Sum(contributionPagibigEE),0) from payroll_summary WHERE Employee_id = @idemployeewtax and idclientp = @idclient  and  payrollmonth  =@payrollmonth and idpayrollsum <@idpayroll --Previous EE	
	
		SELECT @ssseefinal3= COALESCE(Sum(contributionSSSEE),0) from payroll_summary 
		WHERE Employee_id = @idemployeewtax and  idclientp = @idclient and  payrollmonth=@payrollmonth and idpayrollsum = @idpayroll

		SELECT @prossseegrossfinal3= COALESCE(Sum(contributionSSSEEPRO),0) from payroll_summary 
		WHERE Employee_id = @idemployeewtax and  idclientp = @idclient and payrollmonth  = @payrollmonth and idpayrollsum = @idpayroll
			
		SELECT @phieebasic2= COALESCE(Sum(contributionphilhealthEE),0) from payroll_summary 
		WHERE Employee_id = @idemployeewtax and  idclientp = @idclient and payrollmonth  =@payrollmonth and idpayrollsum = @idpayroll

		SELECT @pageebasic2= COALESCE(Sum(contributionPagibigEE),0) from payroll_summary 
		WHERE Employee_id = @idemployeewtax and  idclientp = @idclient and  payrollmonth  =@payrollmonth and idpayrollsum = @idpayroll



		set @TOTALMANDATORIESPREVIOUS  = COALESCE(@ssseeprevious,0)+COALESCE(@prossseeprevious,0)+COALESCE(@previousphiee,0)+COALESCE(@previouspagee,0)
		SET @TOTALMANDATORIES	= COALESCE(@ssseefinal3,0)+COALESCE(@phieebasic2,0)+COALESCE(@pageebasic2,0)+COALESCE(@prossseegrossfinal3,0)


		--if @wtaxbasis ='gross' 
		SET @TOTALGROSS = @forssstotalgrossprevious+@grossamt
		
		----if @wtaxbasis  ='basic'
		----SET @TOTALGROSS = @forssstotalbasicprevious+@basicamt
		

		SET @TAXABLEINCOME = (CAST(@TOTALGROSS AS FLOAT))-(cAST(@TOTALMANDATORIES AS FLOAT)+cAST(@TOTALMANDATORIESPREVIOUS AS FLOAT))

	
	
		SELECT TOP 1  @TAXCOMPENSATIONLEVEL =  compensationlevel FROM TAXTABLENEW where Term = 'Monthly' and Range1 <= @TAXABLEINCOME order by Series desc
		SELECT TOP 1  @TAXPERCENT =  Percentage  FROM TAXTABLENEW where Term = 'Monthly' and Range1 <= @TAXABLEINCOME order by Series desc
		SELECT TOP 1  @TAXPRESCRIBE =  PrescribeTax  FROM TAXTABLENEW where Term = 'Monthly' and Range1 <= @TAXABLEINCOME order by Series desc


		SET @TAXOVER  = @TAXABLEINCOME - @TAXCOMPENSATIONLEVEL
	
		SET @WTAXCOMPENSATION = @TAXOVER * @TAXPERCENT
	
		
		SET @WTAXCOMPENSATIONFINAL  =(@WTAXCOMPENSATION +@TAXPRESCRIBE)-@PREVIOUSWTAX
		
		

		FETCH NEXT FROM myCursor7 INTO @idemployeewtax
	END
	CLOSE myCursor7
	DEALLOCATE myCursor7


-----------------------------End of Tax--------------------------------------------------



END


BEGIN TRY
    BEGIN TRANSACTION;

    -- Monthly + Semi-Monthly
    IF @wtaxsched = 'Monthly'
       AND @frequencypayment = 'Semi-Monthly'
       AND @idclient IN (171, 173, 74)
    BEGIN
        UPDATE payroll_summary
        SET Wtax = @WTAXCOMPENSATIONFINAL
        WHERE idpayrollsum = @idpayroll;
    END;

    -- Monthly + Weekly
    IF @wtaxsched = 'Monthly'
       AND @frequencypayment = 'Weekly'
       AND @idclient = 105
    BEGIN
        UPDATE payroll_summary
        SET Wtax = CASE
                       WHEN idbranchpositionp IN (5723, 5726, 5659, 5736, 5622)
                           THEN @WTAXCOMPENSATIONFINAL
                       ELSE 0
                   END
        WHERE idpayrollsum = @idpayroll;
    END;

    COMMIT TRANSACTION;
END TRY
BEGIN CATCH
    IF @@TRANCOUNT > 0
        ROLLBACK TRANSACTION;

    -- Return the original SQL Server error
    THROW;
END CATCH;





