-- =============================================
-- Author:		<Pat Relos>
-- Create date: <6-21-2024>
-- Description:	<Processing of Loan to Payroll>
-- =============================================
create PROCEDURE [dbo].[SPupdatepayrollstatus]	
-- Add the parameters for the stored procedure here
		
	@idpayrollsum int,
	@payrollstatus nvarchar(6)
AS

BEGIN
	-- SET NOCOUNT ON added to prevent extra result sets from
	-- interfering with SELECT statements.
	SET NOCOUNT ON;
		update payroll_summary
		set payrollstatus = @payrollstatus	
		where idpayrollsum = @idpayrollsum
END
