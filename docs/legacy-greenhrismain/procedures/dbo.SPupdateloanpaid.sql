-- =============================================
-- Author:		<Pat Relos>
-- Create date: <6-21-2024>
-- Description:	<Processing of Loan to Payroll>
-- =============================================
create PROCEDURE [dbo].[SPupdateloanpaid]	
-- Add the parameters for the stored procedure here
		
	@employeeid int,
	@particular nvarchar(50),
	@amount float,
	@datestart date, 
	@idclient int,
	@idloansched int 
	
 AS

BEGIN
	-- SET NOCOUNT ON added to prevent extra result sets from
	-- interfering with SELECT statements.
	SET NOCOUNT ON;
	
	--checking value if exist 
	SELECT employee_id, particular, amount, Date_Start, idclientdeduction
	FROM otherdeduction
	where employee_id = @employeeid and particular = @particular and amount = @amount and Date_Start = @datestart   and idclientdeduction = @idclient
	
	

	--	update loanschedule
	--	set Amountpaid = @amount	
	--	where idloanschedule = @idloansched

	
	--update payroll_summary
	--	set payrollstatus = @payrollstatus	
	--	where idpayrollsum = @idpayrollsum
END
