
CREATE PROCEDURE [dbo].[42bf00bd-6230-462f-a118-a3d93166c3b9V230INDmassWTAX]

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

SELECT employee_id FROM payroll_summary where idclientp = @idclient and Date_Start=@PayrollPeriodStart  AND employee_id = @idemployee0  order by idpayrollsum
 
	OPEN myCursor7
   
   FETCH NEXT FROM myCursor7 INTO @idemployeewtax
	WHILE @@FETCH_STATUS = 0
	
	BEGIN
		SELECT @forssstotalgrossprevious= COALESCE(Sum(grossamttaxable),0) from payroll_summary WHERE Employee_id = @idemployeewtax and  Date_End= @previouscuttoffwtax 
		
		SELECT @PREVIOUSWTAX= COALESCE(Sum(WTAX),0) from payroll_summary WHERE Employee_id = @idemployeewtax  and Date_End= @previouscuttoffwtax  --Previous wtax   				 			  			  
				
		SELECT @ssseeprevious = COALESCE(Sum(contributionSSSEE),0) from payroll_summary WHERE Employee_id = @idemployeewtax and  Date_End= @previouscuttoffwtax
		SELECT @prossseeprevious = COALESCE(Sum(contributionSSSEEpro),0) from payroll_summary WHERE Employee_id = @idemployeewtax and Date_End= @previouscuttoffwtax
		SELECT @previousphiee= COALESCE(Sum(contributionphilhealthEE),0) from payroll_summary WHERE Employee_id = @idemployeewtax and Date_End= @previouscuttoffwtax  
		SELECT @previouspagee= COALESCE(Sum(contributionPagibigEE),0) from payroll_summary WHERE Employee_id = @idemployeewtax  and Date_End= @previouscuttoffwtax  --Previous EE	
	
SELECT @ssseefinal3= COALESCE(Sum(contributionSSSEE),0) from payroll_summary 
WHERE Employee_id = @idemployee0 and  idclientp = @idclient and Date_Start= @PayrollPeriodStart and idpayrollsum <= @idpayroll0

SELECT @prossseegrossfinal3= COALESCE(Sum(contributionSSSEEPRO),0) from payroll_summary 
WHERE Employee_id = @idemployee0 and  idclientp = @idclient and Date_Start= @PayrollPeriodStart and idpayrollsum <= @idpayroll0				
			
SELECT @phieebasic2= COALESCE(Sum(contributionphilhealthEE),0) from payroll_summary 
WHERE Employee_id = @idemployee0 and  idclientp = @idclient and Date_Start= @PayrollPeriodStart and idpayrollsum <= @idpayroll0

SELECT @pageebasic2= COALESCE(Sum(contributionPagibigEE),0) from payroll_summary 
WHERE Employee_id = @idemployee0 and  idclientp = @idclient and Date_Start= @PayrollPeriodStart and idpayrollsum <= @idpayroll0




		
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



IF @idclient IN (105)
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


		   			 		  

 
 
		      FETCH NEXT FROM myCursor0 INTO @idpayroll0,@idemployee0,@sssbasis0,@grossamt0,@basicamt0,@otherbasisamt0,@withsss,@withssspro,@withphi,@withpag,@monthlysalary,@otherbasisamt0,@fixrate0
	END
	CLOSE myCursor0
	DEALLOCATE myCursor0

END

