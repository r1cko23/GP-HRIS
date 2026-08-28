-- =============================================
-- Author:		<Pat Relos>
-- Create date: <1-17-2025>
-- Description:	<Processing of Loan to Payroll>
-- =============================================
create PROCEDURE [dbo].[SPupdatesentemail]	
-- Add the parameters for the stored procedure here
		
	@idpayrollsum int,
	@emailsentcount int 
AS

BEGIN
	-- SET NOCOUNT ON added to prevent extra result sets from
	-- interfering with SELECT statements.
	SET NOCOUNT ON;
	
	
		update payroll_summary
		set 
		emailsentstatus = 'Sent'
		,emailsentnumber=@emailsentcount
		,payslipdatesent=FORMAT(GETDATE(), 'MM/dd/yyyy hh:mm:ss tt')
		where  idpayrollsum = @idpayrollsum
	

END

