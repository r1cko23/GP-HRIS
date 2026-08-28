

CREATE PROCEDURE [dbo].[42bf00bd-6230-462f-a118-a3d93166c3b9V230INDWEEKLYPAGIBIGMASS]

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

 DECLARE @phibasis varchar(20)



 --DECLARE @PayrollPeriodStart1 VARCHAR(20) = '2023-04-16'
declare @previouscuttoffpag as date
SET @previouscuttoffpag = DATEADD(DAY, -1, @PayrollPeriodStart)


    
DECLARE myCursor4 CURSOR FOR
-- open payroll summary      

SELECT employee_id,sssbasis FROM payroll_summary where idclientp = @idclient and Date_Start=@PayrollPeriodStart and department_codep = @idDepartment AND employee_id = @idemployee  order by idpayrollsum
 
	OPEN myCursor4
   
   FETCH NEXT FROM myCursor4 INTO @idemployeepag,@pagbasis
	WHILE @@FETCH_STATUS = 0
	
	BEGIN
			--SET @Counter = @Counter + 1
			--- get the max idpayroll
				SELECT TOP 1  @idpayrollsum4 =  idpayrollsum FROM payroll_summary where Employee_id = @idemployeepag and idclientp = @idclient and Date_Start= @PayrollPeriodStart  order by idpayrollsum desc
			--count trx
				SELECT @countempidpag =  COUNT(Employee_id) FROM  payroll_summary where Employee_id = @idemployeepag and idclientp = @idclient and  payrollmonth= @payrollmonth
				
				SELECT @forpagtotalgross = @grossamt
				
				SELECT @previouspagee= COALESCE(Sum(contributionPagibigEE),0) from payroll_summary WHERE Employee_id = @idemployeepag and idclientp = @idclient  and payrollmonth= @payrollmonth and idpayrollsum <@idpayroll --Previous EE	
				SELECT @previouspager= COALESCE(Sum(contributionPagibigER),0) from payroll_summary WHERE Employee_id = @idemployeepag and idclientp = @idclient  and payrollmonth= @payrollmonth and idpayrollsum <@idpayroll  --previous ER
					
				SELECT TOP 1  @pagibigcontribution= pagibigcontributionee FROM pagibigtable where idpagibig = 1   order by dateupdate desc
			
				SELECT TOP 1  @pageegross = @pagibigcontribution
				SELECT TOP 1  @pagergross = @pagibigcontribution

				SELECT @forpagtotalbasic = @basicamt
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
					
						

		if @pagbasis = 'Gross' and @countempidpag=1 and @withpag=1					
				Begin
					set @pageebasic2 = @pageebasic
					set @pagerbasic2 = @pageebasic
				End
			
			 if @pagbasis = 'Gross'and @countempidpag	>1 	 and @withpag=1
				Begin
					set @pageebasic2 = @pageebasic
					set @pagerbasic2 = @pageebasic
				End
			


			if @pagbasis = 'Basic' and @countempidpag=1 and @withpag=1					
				Begin
					set @pageebasic2 = @pageebasic
					set @pagerbasic2 = @pageebasic
				End
			
			 if @pagbasis = 'Basic'and @countempidpag	>1 	 and @withpag=1
				Begin
					set @pageebasic2 = @pageebasic
					set @pagerbasic2 = @pageebasic
				End
			

	FETCH NEXT FROM myCursor4 INTO @idemployeepag,@phibasis
	END
	CLOSE myCursor4
	DEALLOCATE myCursor4

BEGIN TRY
    BEGIN TRANSACTION;

    UPDATE payroll_summary
    SET
        contributionPagibigEE = @pageebasic2,
        contributionPagibigER = @pageebasic2
    WHERE idpayrollsum = @idpayroll;

    COMMIT TRANSACTION;
END TRY
BEGIN CATCH
    IF @@TRANCOUNT > 0
        ROLLBACK TRANSACTION;

    THROW;
END CATCH;
--select [pagibigee] = @pageebasic


END
