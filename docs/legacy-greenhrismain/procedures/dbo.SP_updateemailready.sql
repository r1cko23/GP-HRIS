-- =============================================
-- Author:		<Pat Relos>
-- Create date: <1-29-2025>
-- Description:	<Processing of Loan to Payroll>
-- =============================================
create PROCEDURE [dbo].[SP_updateemailready]	
-- Add the parameters for the stored procedure here
		
	@idclient int,
	@fromdate date
	
AS

BEGIN
	-- SET NOCOUNT ON added to prevent extra result sets from
	-- interfering with SELECT statements.
	SET NOCOUNT ON;
UPDATE       payroll_summary
SET                emailpayslipready = 'Y'
FROM            payroll_summary INNER JOIN
                         Employee ON payroll_summary.Employee_id = Employee.Employee_id
WHERE        (payroll_summary.Date_Start = @fromdate) AND (payroll_summary.idclientp = @idclient) AND (Employee.pri_email IS NOT NULL)

END
