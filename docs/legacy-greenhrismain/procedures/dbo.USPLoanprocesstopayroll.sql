-- =============================================
-- Author:		<Pat Relos>
-- Create date: <7-16-2023>
-- Description:	<Processing of Loan to Payroll>
-- =============================================
CREATE PROCEDURE [dbo].[USPLoanprocesstopayroll]	
-- Add the parameters for the stored procedure here
	
	
	@idclient int,
	@PayrollPeriodStart date,	
	@idDepartment int
	
AS

BEGIN
	-- SET NOCOUNT ON added to prevent extra result sets from
	-- interfering with SELECT statements.
	SET NOCOUNT ON;
	
DECLARE	@loanidemployee int
DECLARE	@loanidclient int
DECLARE	@loanparticular Varchar(30) 
DECLARE	@loanPayrollPeriodStart date
DECLARE	@loanamt float
declare @loandiddepartment int
declare @loanidloan int
declare @loanidloanschedule int
declare @codeotherdeduction float
DECLARE @amount2 float -- no use so far 
DECLARE @includetopayslip varchar(10)
DECLARE	@loanPayrollPeriodend date
DECLARE @count INT
DECLare @amountpaid float




DECLARE myCursor CURSOR FOR
   	  
SELECT        loan.employee_id, loan.idclientloan, loan.particular, loanschedule.datefrom, loanschedule.Amount, loan.iddepartmentloan, loan.idloan, loanschedule.idloanschedule, otherdeductionclass.codeotherdeduction,otherdeductionclass.includetopayslip,loanschedule.dateto,loanschedule.Amountpaid
FROM            loan INNER JOIN
                         loanschedule ON loan.idloan = loanschedule.idloan INNER JOIN
                         otherdeductionclass ON loan.particular = otherdeductionclass.otherdeduction_desc
WHERE        (loan.idclientloan = @idclient) AND (loanschedule.datefrom = @PayrollPeriodStart) and (loan.iddepartmentloan = @idDepartment)

	OPEN myCursor
   
	FETCH NEXT FROM myCursor INTO @loanidemployee, @loanidclient, @loanparticular,@loanPayrollPeriodStart, @loanamt,@loandiddepartment,@loanidloan,@loanidloanschedule,@codeotherdeduction,@includetopayslip,@loanPayrollPeriodend,@amountpaid
	WHILE @@FETCH_STATUS = 0
	BEGIN
		
	SELECT @count =  COUNT(Employee_id) FROM  otherdeduction where idloanschedule = @loanidloanschedule 				

	if @count = 0 and @amountpaid  = 0 -- means if the amount paid from schedule has a value system will not insert data to other deduction
	Begin
		SET @amount2 = 
			CASE
				WHEN @includetopayslip = 'True' Then @loanamt
				WHEN @includetopayslip= 'False' Then 0
			END;

			INSERT INTO otherdeduction
			(	
			employee_id
			,idclientdeduction
			,particular
			,Date_Start
			,amount
			,iddepartmentdeduction
			,idloan
			,idloanschedule
			,codeotherdeduction
			,amount2
			,Date_End		
		
			)
			VALUES			
			(
			 @loanidemployee
			,@loanidclient
			,@loanparticular
			,@loanPayrollPeriodStart
			,@loanamt
			,@loandiddepartment
			,@loanidloan
			,@loanidloanschedule
			,@codeotherdeduction
			,0
			,@loanPayrollPeriodend
			)
		End 
			FETCH NEXT FROM myCursor INTO  @loanidemployee, @loanidclient, @loanparticular,@loanPayrollPeriodStart, @loanamt,@loandiddepartment,@loanidloan,@loanidloanschedule,@codeotherdeduction,@includetopayslip,@loanPayrollPeriodend,@amountpaid
		END
		CLOSE myCursor
		DEALLOCATE myCursor

END

--SELECT * FROM otherdeduction where Date_Start = '2023-04-01'
--use hrismain
--delete from otherdeduction where idotherdeduction = 38991
--select * from loan
--select * from otherdeductionclass

--select * from loanschedule
