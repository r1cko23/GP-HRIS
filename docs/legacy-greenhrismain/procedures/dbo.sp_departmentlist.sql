create PROCEDURE [dbo].[sp_departmentlist] 
	-- Add the parameters for the stored procedure here
		--@idclient integer
		@idbranch integer
AS 
BEGIN
	-- SET NOCOUNT ON added to prevent extra result sets from
	-- interfering with SELECT statements.
	SET NOCOUNT ON;
	
SELECT 	 BillingDepartment
FROM     client_branch_position
where idclientbranch = @idbranch
order by BillingDepartment asc


END
